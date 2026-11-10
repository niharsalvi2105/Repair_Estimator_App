"""Reconcile Account leading zeros from Equipment by exact Account.Id; dry-run by default."""
import argparse
import collections
import ctypes
from email import policy
from email.parser import BytesParser
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import urllib.error
import urllib.request
import uuid

MODULE = importlib.util.spec_from_file_location(
    "customer_bulk", Path(__file__).with_name("import-customer-masters-bulk.py"))
bulk = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(bulk)


def _open_posix_private_backup(path):
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    flags |= getattr(os, "O_CLOEXEC", 0)
    descriptor = os.open(path, flags, 0o600)
    try:
        os.fchmod(descriptor, 0o600)
        details = os.fstat(descriptor)
        if (stat.S_IMODE(details.st_mode) != 0o600
                or details.st_uid != os.geteuid()):
            raise PermissionError("Private backup permissions could not be verified")
        return os.fdopen(descriptor, "w", encoding="utf-8", newline="\n")
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        raise


def _windows_current_user_sid(advapi32, kernel32):
    from ctypes import wintypes

    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    advapi32.OpenProcessToken.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.GetTokenInformation.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD)]
    advapi32.GetTokenInformation.restype = wintypes.BOOL
    advapi32.ConvertSidToStringSidW.argtypes = [
        ctypes.c_void_p, ctypes.POINTER(ctypes.POINTER(ctypes.c_wchar))]
    advapi32.ConvertSidToStringSidW.restype = wintypes.BOOL

    class SID_AND_ATTRIBUTES(ctypes.Structure):
        _fields_ = [("Sid", ctypes.c_void_p), ("Attributes", wintypes.DWORD)]

    class TOKEN_USER(ctypes.Structure):
        _fields_ = [("User", SID_AND_ATTRIBUTES)]

    token = wintypes.HANDLE()
    if not advapi32.OpenProcessToken(
            kernel32.GetCurrentProcess(), 0x0008, ctypes.byref(token)):
        raise ctypes.WinError()
    try:
        required = wintypes.DWORD()
        sized = advapi32.GetTokenInformation(token, 1, None, 0, ctypes.byref(required))
        if sized or not required.value or ctypes.get_last_error() != 122:
            raise ctypes.WinError()
        token_data = ctypes.create_string_buffer(required.value)
        if not advapi32.GetTokenInformation(
                token, 1, token_data, required.value, ctypes.byref(required)):
            raise ctypes.WinError()
        user_sid = ctypes.cast(token_data, ctypes.POINTER(TOKEN_USER)).contents.User.Sid
        sid_text_pointer = ctypes.POINTER(ctypes.c_wchar)()
        if not advapi32.ConvertSidToStringSidW(user_sid, ctypes.byref(sid_text_pointer)):
            raise ctypes.WinError()
        try:
            sid_text = ctypes.wstring_at(sid_text_pointer)
        finally:
            kernel32.LocalFree(ctypes.cast(sid_text_pointer, ctypes.c_void_p))
        return token_data, user_sid, sid_text
    finally:
        kernel32.CloseHandle(token)


def _verify_windows_private_backup(handle):
    from ctypes import wintypes

    class ACL_SIZE_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("AceCount", wintypes.DWORD),
            ("AclBytesInUse", wintypes.DWORD),
            ("AclBytesFree", wintypes.DWORD),
        ]

    class ACCESS_ALLOWED_ACE(ctypes.Structure):
        _fields_ = [
            ("AceType", wintypes.BYTE),
            ("AceFlags", wintypes.BYTE),
            ("AceSize", wintypes.WORD),
            ("Mask", wintypes.DWORD),
            ("SidStart", wintypes.DWORD),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    advapi32.OpenProcessToken.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    advapi32.GetTokenInformation.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD)]
    advapi32.ConvertSidToStringSidW.argtypes = [
        ctypes.c_void_p, ctypes.POINTER(ctypes.POINTER(ctypes.c_wchar))]
    advapi32.GetKernelObjectSecurity.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD)]
    advapi32.GetSecurityDescriptorOwner.argtypes = [
        ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.BOOL)]
    advapi32.GetSecurityDescriptorDacl.argtypes = [
        ctypes.c_void_p, ctypes.POINTER(wintypes.BOOL), ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(wintypes.BOOL)]
    advapi32.GetSecurityDescriptorControl.argtypes = [
        ctypes.c_void_p, ctypes.POINTER(wintypes.WORD), ctypes.POINTER(wintypes.DWORD)]
    advapi32.GetAclInformation.argtypes = [
        ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD]
    advapi32.GetAce.argtypes = [
        ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p)]
    advapi32.EqualSid.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    advapi32.EqualSid.restype = wintypes.BOOL
    advapi32.GetKernelObjectSecurity.restype = wintypes.BOOL

    user_data, user_sid, _ = _windows_current_user_sid(advapi32, kernel32)
    security_size = wintypes.DWORD()
    security_information = 0x00000001 | 0x00000004
    sized = advapi32.GetKernelObjectSecurity(
        handle, security_information, None, 0, ctypes.byref(security_size))
    if sized or not security_size.value or ctypes.get_last_error() != 122:
        raise ctypes.WinError()
    security_descriptor = ctypes.create_string_buffer(security_size.value)
    if not advapi32.GetKernelObjectSecurity(
            handle, security_information, security_descriptor, security_size.value,
            ctypes.byref(security_size)):
        raise ctypes.WinError()

    owner_sid = ctypes.c_void_p()
    owner_defaulted = wintypes.BOOL()
    dacl_present = wintypes.BOOL()
    dacl = ctypes.c_void_p()
    dacl_defaulted = wintypes.BOOL()
    control = wintypes.WORD()
    revision = wintypes.DWORD()
    if (not advapi32.GetSecurityDescriptorOwner(
            security_descriptor, ctypes.byref(owner_sid), ctypes.byref(owner_defaulted))
            or not advapi32.GetSecurityDescriptorDacl(
                security_descriptor, ctypes.byref(dacl_present), ctypes.byref(dacl),
                ctypes.byref(dacl_defaulted))
            or not advapi32.GetSecurityDescriptorControl(
                security_descriptor, ctypes.byref(control), ctypes.byref(revision))):
        raise ctypes.WinError()
    if (not owner_sid or owner_defaulted.value
            or not advapi32.EqualSid(owner_sid, user_sid)
            or not dacl_present.value or dacl_defaulted.value or not dacl
            or not control.value & 0x1000):  # SE_DACL_PROTECTED
        raise PermissionError("Private backup permissions could not be verified")

    acl_information = ACL_SIZE_INFORMATION()
    if not advapi32.GetAclInformation(
            dacl, ctypes.byref(acl_information), ctypes.sizeof(acl_information), 2):
        raise ctypes.WinError()
    if acl_information.AceCount != 1:
        raise PermissionError("Private backup permissions could not be verified")
    ace_pointer = ctypes.c_void_p()
    if not advapi32.GetAce(dacl, 0, ctypes.byref(ace_pointer)):
        raise ctypes.WinError()
    ace = ctypes.cast(ace_pointer, ctypes.POINTER(ACCESS_ALLOWED_ACE)).contents
    ace_sid = ctypes.cast(
        ctypes.byref(ace, ACCESS_ALLOWED_ACE.SidStart.offset), ctypes.c_void_p)
    if (ace.AceType != 0 or ace.AceFlags != 0 or ace.Mask != 0x001F01FF
            or not advapi32.EqualSid(ace_sid, user_sid)):
        raise PermissionError("Private backup permissions could not be verified")
    _ = user_data


def _open_windows_private_backup(path):
    from ctypes import wintypes
    import msvcrt

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)

    class SECURITY_ATTRIBUTES(ctypes.Structure):
        _fields_ = [
            ("nLength", wintypes.DWORD),
            ("lpSecurityDescriptor", ctypes.c_void_p),
            ("bInheritHandle", wintypes.BOOL),
        ]

    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CreateFileW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
        ctypes.POINTER(SECURITY_ATTRIBUTES), wintypes.DWORD, wintypes.DWORD,
        wintypes.HANDLE]
    kernel32.CreateFileW.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [
        wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p),
        ctypes.POINTER(wintypes.DWORD)]
    advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.restype = wintypes.BOOL

    _, _, user_sid_text = _windows_current_user_sid(advapi32, kernel32)
    security_descriptor = ctypes.c_void_p()
    if not advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW(
            "O:" + user_sid_text + "D:P(A;;FA;;;" + user_sid_text + ")",
            1, ctypes.byref(security_descriptor), None):
        raise ctypes.WinError()
    handle = None
    try:
        attributes = SECURITY_ATTRIBUTES(
            ctypes.sizeof(SECURITY_ATTRIBUTES), security_descriptor, False)
        created = kernel32.CreateFileW(
            str(path), 0x40000000 | 0x00020000, 0, ctypes.byref(attributes),
            1, 0x00000080, None)  # GENERIC_WRITE | READ_CONTROL, CREATE_NEW
        if created == wintypes.HANDLE(-1).value:
            raise ctypes.WinError()
        handle = created
        _verify_windows_private_backup(handle)
        descriptor = msvcrt.open_osfhandle(handle, os.O_WRONLY | os.O_BINARY)
        handle = None
        try:
            return os.fdopen(descriptor, "w", encoding="utf-8", newline="\n")
        except BaseException:
            os.close(descriptor)
            raise
    finally:
        if handle is not None:
            kernel32.CloseHandle(handle)
        kernel32.LocalFree(security_descriptor)


def open_private_backup(path):
    if os.name == "nt":
        return _open_windows_private_backup(path)
    return _open_posix_private_backup(path)


def source_numbers(path):
    numbers = {}
    conflicts = set()
    counts = collections.Counter()
    before = bulk.fingerprint(path)
    rows = bulk.stream_rows(path, "Equipment Master")
    try:
        row_number, header = next(rows)
        positions = {value: index for index, (_, value) in header.items()}
        if row_number != 1 or not {"Account.Id", "Account.AccountNumber"} <= positions.keys():
            raise RuntimeError("Missing Equipment Account source columns")
        for _, cells in rows:
            counts["equipment_rows"] += 1
            try:
                parent = bulk.customer.source_id(cells.get(positions["Account.Id"], ("text", None)))
                number = bulk.customer.text(cells.get(positions["Account.AccountNumber"], ("text", None)))
            except bulk.customer.Rejected:
                counts["invalid_source_rows"] += 1
                continue
            if not number or number != number.strip():
                counts["missing_or_whitespace_number_rows"] += 1
                continue
            if parent in numbers and numbers[parent] != number:
                conflicts.add(parent)
            numbers[parent] = number
    finally:
        rows.close()
    if bulk.fingerprint(path) != before:
        raise RuntimeError("Equipment workbook changed during audit")
    counts["source_accounts"] = len(numbers)
    counts["conflicting_source_accounts"] = len(conflicts)
    if conflicts:
        raise RuntimeError("Conflicting Equipment Account numbers; no correction may be inferred")
    return numbers, dict(counts)


def correction_plan(numbers, records, max_length):
    by_source = collections.defaultdict(list)
    by_number = collections.defaultdict(set)
    desired_counts = collections.Counter(numbers.values())
    counts = collections.Counter()
    for record in records:
        counts["tenant_accounts_read"] += 1
        source = record.get("re_salesforceaccountid")
        if source:
            by_source[source].append(record)
        if record.get("accountnumber") is not None:
            by_number[record["accountnumber"]].add(record["accountid"])
    planned = []
    for source, expected in numbers.items():
        matches = by_source.get(source, [])
        if not matches:
            counts["source_accounts_not_imported"] += 1
            continue
        if len(matches) != 1:
            counts["blocked_duplicate_source_identity"] += 1
            continue
        record = matches[0]
        current = record.get("accountnumber")
        if current == expected:
            counts["already_exact"] += 1
            continue
        if (not isinstance(current, str) or not re.fullmatch(r"[0-9]+", current)
                or not re.fullmatch(r"[0-9]+", expected)
                or current.lstrip("0") != expected.lstrip("0")):
            counts["blocked_nonzero_digit_difference"] += 1
            continue
        if len(expected) > max_length:
            counts["blocked_length"] += 1
            continue
        if len(expected) <= len(current) or not expected.startswith("0"):
            counts["blocked_not_missing_leading_zeros"] += 1
            continue
        if desired_counts[expected] > 1 or by_number[expected] - {record["accountid"]}:
            counts["blocked_number_collision"] += 1
            continue
        if not record.get("@odata.etag"):
            counts["blocked_missing_etag"] += 1
            continue
        planned.append((source, expected, record))
    counts["planned_corrections"] = len(planned)
    return planned, dict(counts)


def apply_correction(api, source, expected, record):
    account_id = record["accountid"]
    if re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", account_id) is None:
        raise RuntimeError("Invalid Account GUID; correction stopped")
    endpoint = "accounts(" + account_id + ")"
    collisions = api.find("accounts", ["accountid"], "accountnumber", expected)
    if any(row["accountid"] != account_id for row in collisions):
        raise RuntimeError("Account number collision appeared after audit")
    api.request("PATCH", endpoint, {"accountnumber": expected},
                concurrency={"If-Match": record["@odata.etag"]})
    actual = api.request("GET", endpoint + "?$select=accountid,re_salesforceaccountid,accountnumber")
    if (actual.get("accountid") != account_id or actual.get("re_salesforceaccountid") != source
            or actual.get("accountnumber") != expected):
        raise RuntimeError("Account correction readback failed; stop and reconcile before retry")


def batch_body(planned):
    boundary = "batch_" + uuid.uuid4().hex
    changeset = "changeset_" + uuid.uuid4().hex
    lines = ["--" + boundary, "Content-Type: multipart/mixed; boundary=" + changeset, ""]
    for index, (_, expected, record) in enumerate(planned, 1):
        account_id = record["accountid"]
        if re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", account_id) is None:
            raise RuntimeError("Invalid Account GUID; no batch sent")
        etag = record["@odata.etag"]
        if re.fullmatch(r'W/"[0-9]+"', etag) is None:
            raise RuntimeError("Invalid Account ETag; no batch sent")
        lines.extend(["--" + changeset, "Content-Type: application/http",
                      "Content-Transfer-Encoding: binary", "Content-ID: " + str(index), "",
                      "PATCH " + bulk.customer.BASE + "accounts(" + account_id + ") HTTP/1.1",
                      "Content-Type: application/json", "If-Match: " + etag, "",
                      json.dumps({"accountnumber": expected}), ""])
    lines.extend(["--" + changeset + "--", "--" + boundary + "--", ""])
    return boundary, "\r\n".join(lines).encode("utf-8")


def verify_batch_response(content_type, body, expected_count):
    message = BytesParser(policy=policy.default).parsebytes(
        ("Content-Type: " + content_type + "\r\nMIME-Version: 1.0\r\n\r\n").encode("ascii") + body)
    statuses = []
    for part in message.walk():
        if part.get_content_type() == "application/http":
            payload = part.get_payload(decode=True)
            match = re.match(rb"HTTP/1\.[01] ([0-9]{3})", payload)
            if not match:
                raise RuntimeError("Invalid batch response; stop and reconcile before retry")
            statuses.append(int(match[1]))
    if len(statuses) != expected_count or any(status != 204 for status in statuses):
        raise RuntimeError("Account batch was not fully successful; stop and reconcile before retry")


def apply_batch(api, planned):
    conditions = ["accountnumber eq '" + number.replace("'", "''") + "'" for _, number, _ in planned]
    expected_ids = {number: record["accountid"] for _, number, record in planned}
    for record in api.query("accounts", ["accountid", "accountnumber"], " or ".join(conditions)):
        if record["accountid"] != expected_ids[record["accountnumber"]]:
            raise RuntimeError("Account number collision appeared after audit; no batch sent")
    api.refresh()
    boundary, body = batch_body(planned)
    headers = dict(api.api.headers, **{"Content-Type": "multipart/mixed; boundary=" + boundary})
    request = urllib.request.Request(bulk.customer.BASE + "$batch", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            verify_batch_response(response.headers["Content-Type"], response.read(), len(planned))
    except urllib.error.HTTPError as error:
        status = error.code
        error.close()
        raise RuntimeError("Account batch HTTP " + str(status) + "; stop and reconcile before retry") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Account batch outcome unknown; stop and reconcile before retry") from None
    source_filter = " or ".join("re_salesforceaccountid eq '" + source + "'" for source, _, _ in planned)
    actual = list(api.query("accounts", ["accountid", "re_salesforceaccountid", "accountnumber"], source_filter))
    expected = {(record["accountid"], source, number) for source, number, record in planned}
    observed = {(row["accountid"], row.get("re_salesforceaccountid"), row.get("accountnumber")) for row in actual}
    if len(actual) != len(planned) or observed != expected:
        raise RuntimeError("Account batch readback failed; stop and reconcile before retry")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True, help="Sanitized counts only")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-updates", type=int,
                        help="Required with --apply; must match a freshly audited correction count")
    parser.add_argument("--backup", type=Path, help="New private JSON file outside the repository, required for --apply")
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()
    if args.report.resolve() == args.source.resolve():
        parser.error("Report must not overwrite the source workbook")
    if args.apply and (args.expected_updates is None or args.expected_updates < 0):
        parser.error("--apply requires a nonnegative --expected-updates count")
    if not 1 <= args.batch_size <= 100:
        parser.error("--batch-size must be 1..100")
    if args.apply and (not args.backup or args.backup.exists()
                       or args.backup.resolve().is_relative_to(Path(__file__).resolve().parents[1])
                       or args.backup.resolve() in (args.source.resolve(), args.report.resolve())):
        parser.error("--apply requires a new private backup outside the repository")
    report = {"status": "auditing", "verified_corrections": 0}
    try:
        numbers, source_counts = source_numbers(args.source)
        report.update(source_counts)
        api = bulk.BulkApi()
        lengths = bulk.customer.preflight(api, bulk.customer.SPECS["accounts"])
        records = api.query("accounts", ["accountid", "re_salesforceaccountid", "accountnumber"])
        planned, counts = correction_plan(numbers, records, lengths["accountnumber"])
        report.update(counts)
        if args.apply:
            if len(planned) != args.expected_updates:
                raise RuntimeError("Fresh correction count differs from the approved count; no writes started")
            args.backup.parent.mkdir(parents=True, exist_ok=True)
            with open_private_backup(args.backup) as backup:
                json.dump({"source_sha256": bulk.fingerprint(args.source), "changes": [
                    {"source_id": source, "expected": expected, "before": record}
                    for source, expected, record in planned]}, backup)
                backup.flush()
                os.fsync(backup.fileno())
            for start in range(0, len(planned), args.batch_size):
                batch = planned[start:start + args.batch_size]
                apply_batch(api, batch)
                report["verified_corrections"] += len(batch)
                report["status"] = "applying_verified_batches"
                args.report.parent.mkdir(parents=True, exist_ok=True)
                args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
                if start == 0 or report["verified_corrections"] % 1000 == 0:
                    print(json.dumps({"verified_corrections": report["verified_corrections"]}), flush=True)
            report["status"] = "corrections_verified"
        else:
            report["status"] = "dry_run_no_writes"
    except (RuntimeError, OSError, ValueError):
        report["status"] = "failed_stop_and_reconcile"
        raise
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
