export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={`${id}-error`} className="field-error" role="alert">{message}</span> : null
}
