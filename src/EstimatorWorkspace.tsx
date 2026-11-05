import { useEffect, useMemo, useState, type Dispatch, type SetStateAction, type RefObject } from 'react'
import type { Branch, DraftReferences, Equipment, RepairPackage, ReferenceOption } from './data/repairEstimatorRepository'
import type { AppSession } from './data/sessionRepository'
import type { Market } from './data/estimateQuery'
import type { AppCopy, EquipmentPasteResult, SelectedEquipment } from './App'
import { RequestFields, type RequestInputs } from './RequestFields'
import { PricingSummary } from './PricingSummary'
import { BranchSelect } from './BranchSelect'
import { CustomerMasterSelect } from './CustomerMasterSelect'
import { packageEquipmentNumbers, validPackageEquipment } from './data/packageEquipment'
import type { AccountMasterOption, ContactMasterOption } from './data/customerMasterRepository'
import { CustomCostLines } from './CustomCostLines'
import { PackageSelect } from './PackageSelect'
import { EquipmentSelect } from './EquipmentSelect'
import { EquipmentExcelUpload } from './EquipmentExcelUpload'
import { EquipmentPackageCosts } from './EquipmentPackageCosts'
import { localizePackage, localizeScope } from './data/packageSearch'
import { MAX_DRAFT_CHILD_OPERATIONS, type DraftLabor, type DraftMaterial, type ExportDelivery } from './data/draftContract'
import { submissionDeliveryMessage } from './data/submissionDelivery'
import { getPackageCostRates } from './data/repairEstimatorRepository'
import { customCostsError } from './data/requestValidation'
import { PackageCostDetails } from './PackageCostDetails'
import { calculatePackageCost, type CostRate } from './data/packageCosts'

type Language = 'en' | 'fr'
type Props = {
  requestSection: RefObject<HTMLElement | null>
  t: AppCopy
  draftVersion: string | null
  draftDirty: boolean
  dt: Record<'title' | 'province' | 'currency' | 'save' | 'saving' | 'saved' | 'open'
    | 'working' | 'new' | 'warning' | 'required' | 'note' | 'error' | 'reload' | 'locked', string>
  draftNumber: string
  newDraft: () => void
  onSaveOpportunity: () => void
  draftBusy: boolean
  draftError: string
  canStart: boolean
  openDraft: (id: string) => Promise<void>
  draftId: string
  selectedAccount: AccountMasterOption | null
  selectedContact: ContactMasterOption | null
  onSelectAccount: (account: AccountMasterOption | null) => void
  onSelectContact: (contact: ContactMasterOption | null) => void
  canWork: boolean
  draftComplete: boolean
  saveDraft: (submit?: boolean) => Promise<void>
  submitted: boolean
  exportDelivery?: ExportDelivery
  step: number
  estimateTitle: string
  setEstimateTitle: Dispatch<SetStateAction<string>>
  draftReferences: DraftReferences | undefined
  selectedBranch: Branch | undefined
  draftReferenceError: string
  setReferenceAttempt: Dispatch<SetStateAction<number>>
  branchLoading: boolean
  branchError: string
  loadBranches: () => Promise<void>
  market: Market
  marketBranches: Branch[]
  branchId: string
  changeBranch: (nextBranchId: string) => void
  language: Language
  referenceError: string
  setReferenceError: Dispatch<SetStateAction<string>>
  references: { equipmentTypes: ReferenceOption[]; jobTypes: ReferenceOption[]; } | undefined
  equipmentTypeId: string
  setEquipmentTypeId: Dispatch<SetStateAction<string>>
  jobTypeId: string
  setJobTypeId: Dispatch<SetStateAction<string>>
  savedSalesperson: string
  session: AppSession | undefined
  buildingName: string
  setBuildingName: Dispatch<SetStateAction<string>>
  stateId: string
  updateRequestInput: (key: keyof RequestInputs, value: string) => void
  requestInputs: RequestInputs
  equipmentQuery: string
  changeEquipmentQuery: (value: string) => void
  equipmentLoading: boolean
  equipmentError: string
  equipmentResults: Equipment[]
  equipmentBulkBusy: boolean
  toggleEquipment: (equipment: Equipment) => void
  selectedEquipment: SelectedEquipment[]
  addUnlistedEquipment: () => void
  addEquipmentList: (text: string) => Promise<void>
  uploadEquipmentExcel: (file: File) => Promise<void>
  equipmentPasteResult: EquipmentPasteResult | undefined
  setSelectedEquipment: Dispatch<SetStateAction<SelectedEquipment[]>>
  selectedPackages: Omit<RepairPackage, 're_effectivefrom' | 're_effectiveto'>[]
  packageLoading: boolean
  packageError: string
  packageResults: RepairPackage[]
  togglePackage: (repairPackage: RepairPackage) => void
  retryPackages: () => void
  selectedPackageIds: Set<string>
  setSelectedPackages: Dispatch<SetStateAction<Omit<RepairPackage, 're_effectivefrom' | 're_effectiveto'>[]>>
  marketName: 'MKO' | 'CKE' | 'CKQ'
  customerName: string
  customerEmail: string
  customerPhone: string
  setStep: Dispatch<SetStateAction<number>>
  onDashboard: () => void
  laborLines: DraftLabor[]
  materialLines: DraftMaterial[]
  setLaborLines: Dispatch<SetStateAction<DraftLabor[]>>
  setMaterialLines: Dispatch<SetStateAction<DraftMaterial[]>>
}

export default function EstimatorWorkspace({
  requestSection, t, draftVersion, draftDirty, dt,
  draftNumber, newDraft, onSaveOpportunity, draftBusy, draftError, canStart, openDraft,
  draftId, selectedAccount, selectedContact, onSelectAccount, onSelectContact,
  canWork, draftComplete, saveDraft, submitted, exportDelivery, step,
  estimateTitle, setEstimateTitle, draftReferences, selectedBranch, draftReferenceError,
  setReferenceAttempt, branchLoading, branchError, loadBranches, market,
  marketBranches, branchId, changeBranch, language, referenceError,
  setReferenceError, references, equipmentTypeId, setEquipmentTypeId, jobTypeId,
  setJobTypeId, savedSalesperson, session, buildingName, setBuildingName,
  stateId, updateRequestInput, requestInputs, equipmentQuery,
  changeEquipmentQuery, equipmentLoading, equipmentError, equipmentResults, equipmentBulkBusy, toggleEquipment,
  selectedEquipment, addUnlistedEquipment, addEquipmentList, uploadEquipmentExcel, equipmentPasteResult, setSelectedEquipment,
  selectedPackages, packageLoading, packageError, packageResults, togglePackage, retryPackages,
  selectedPackageIds, setSelectedPackages, marketName, customerName,
  customerEmail, customerPhone, setStep,
  onDashboard, laborLines, materialLines, setLaborLines, setMaterialLines,
}: Props) {
  const [packagePage, setPackagePage] = useState(0)
  const [activeCustom, setActiveCustom] = useState<string>()
  const [customError, setCustomError] = useState('')
  const [preview, setPreview] = useState<{ signature: string; total?: number; error?: string }>()
  const [rateResult, setRateResult] = useState<{ branchId: string; rates?: CostRate[]; error?: string }>()
  const [rateAttempt, setRateAttempt] = useState(0)
  const needsRates = step >= 2 && selectedPackages.length > 0
  useEffect(() => {
    if (!branchId || !needsRates) return
    let active = true
    getPackageCostRates(branchId).then(
      (rates) => { if (active) setRateResult({ branchId, rates }) },
      (reason: unknown) => { if (active) setRateResult({ branchId, error: reason instanceof Error ? reason.message : String(reason) }) },
    )
    return () => { active = false }
  }, [branchId, needsRates, rateAttempt])
  const rates = rateResult?.branchId === branchId ? rateResult.rates ?? [] : []
  const customPackages = selectedPackages.filter((p) => p.re_iscustompackage)
  const customValidation = customCostsError(customPackages.map((p) => p.re_repairpackageid), laborLines, materialLines, language)
  const marketCurrencyId = marketBranches.length > 0 &&
    marketBranches.every(branch => branch._re_currency_value === marketBranches[0]._re_currency_value)
    ? marketBranches[0]._re_currency_value : undefined
  const currency = draftReferences?.currencies.find((c) => c.id ===
    (selectedBranch?._re_currency_value ?? marketCurrencyId))?.code
  const costInputs = {
    quantity: selectedEquipment.length, rates, time: Number(requestInputs.re_timecategory || NaN),
    tax: requestInputs.re_usetax?.trim() ? Number(requestInputs.re_usetax) : NaN,
    freight: requestInputs.re_freight?.trim() ? Number(requestInputs.re_freight) : NaN,
    labor: laborLines, materials: materialLines, language, currency,
  }
  const quantityFor = (p: RepairPackage | Omit<RepairPackage, 're_effectivefrom' | 're_effectiveto'>) =>
    packageEquipmentNumbers(p, selectedEquipment).length
  const assignmentValid = selectedPackages.every((p) => validPackageEquipment(p, selectedEquipment))
  const previewSignature = JSON.stringify({ selectedPackages, selectedEquipment, requestInputs, rates, laborLines, materialLines, currency })
  function calculatePreview() {
    try {
      if (customValidation) throw new Error(customValidation)
      if (!currency || !assignmentValid || !selectedPackages.length) throw new Error(language === 'fr'
        ? 'Sélectionnez la devise et au moins un équipement par forfait.' : 'Select a currency and at least one equipment unit per package.')
      let total = selectedPackages.reduce((sum, p) => sum + calculatePackageCost(p,
        quantityFor(p), rates, costInputs.time, costInputs.tax, costInputs.freight, laborLines, materialLines).total, 0)
      const mechanic = rates.filter((rate) => rate.role === 126110000 && rate.time === costInputs.time)
      if (mechanic.length !== 1) throw new Error(language === 'fr' ? 'Taux mécanicien manquant ou ambigu.' : 'Mechanic cost rate is missing or ambiguous.')
      const additional = ['re_additionallaborhours', 're_additionalmaterial', 're_additionalmiscellaneous'].map((field) => {
        const text = requestInputs[field as keyof RequestInputs]
        const value = text?.trim() ? Number(text) : 0
        if (!Number.isFinite(value) || value < 0) throw new Error(language === 'fr' ? 'Coûts supplémentaires invalides.' : 'Additional cost inputs are invalid.')
        return value
      })
      total += additional[0] * mechanic[0].rate + (additional[1] + additional[2]) * (1 + costInputs.tax / 100 + costInputs.freight / 100)
      if (!Number.isFinite(total)) throw new Error(language === 'fr' ? 'Coût indisponible.' : 'Cost is unavailable.')
      setPreview({ signature: previewSignature, total })
    } catch (reason) { setPreview({ signature: previewSignature, error: reason instanceof Error ? reason.message : String(reason) }) }
  }
  const localPreview = <section className="form-card local-cost-preview">
    <h2>{language === 'fr' ? 'Aperçu local des coûts — non enregistré' : 'Local cost preview — not saved'}</h2>
    <p className="field-help">{language === 'fr'
      ? 'Estimation des coûts des forfaits et ajouts, pas un prix de vente ni un CMII. Aucune écriture Dataverse. La tarification officielle exige un compte, un contact et un enregistrement valide.'
      : 'Estimated package and additional costs, not selling prices or CMII. No Dataverse writes. Authoritative pricing requires an Account, Contact and valid save.'}</p>
    <button type="button" className="button secondary local-calculate-action" disabled={!canWork || draftBusy}
      onClick={calculatePreview}>{language === 'fr' ? 'Calculer l’aperçu des coûts' : 'Calculate cost preview'}</button>
    {preview?.signature === previewSignature ? preview.error
      ? <p className="error-box" role="alert">{preview.error}</p>
      : <output className="local-cost-total">{preview.total?.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-CA',
        { style: 'currency', currency })}</output>
      : preview && <p role="status">{language === 'fr' ? 'Aperçu obsolète : recalculez après les modifications.' : 'Preview is out of date: recalculate after changes.'}</p>}
  </section>
  function choosePackage(p: RepairPackage) {
    const adding = !selectedPackageIds.has(p.re_repairpackageid)
    togglePackage(p)
    if (adding && p.re_iscustompackage) { setActiveCustom(p.re_repairpackageid); setCustomError(''); setStep(3) }
  }
  function finishCustomPackage() {
    if (customValidation) { setCustomError(customValidation); return }
    const controls = requestSection.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
    if (controls && !Array.from(controls).every((input) => input.reportValidity())) return
    try {
      // Validate the entered package costs before estimate-wide tax/freight are configured.
      for (const p of customPackages) calculatePackageCost(p, quantityFor(p), rates, costInputs.time,
        0, 0, laborLines, materialLines)
      setCustomError(''); setActiveCustom(undefined); setStep(2)
    } catch (reason) { setCustomError(reason instanceof Error ? reason.message : String(reason)) }
  }
  const pageSize = 20
  const currentPackagePage = Math.min(packagePage, Math.max(0, Math.ceil(selectedPackages.length / pageSize) - 1))
  const hasCustom = selectedPackages.some((p) => p.re_iscustompackage)
  const selectedEquipmentNumbers = useMemo(() => new Set(selectedEquipment.map((item) => item.number)), [selectedEquipment])
  const canAdd = selectedPackages.length + selectedEquipment.length + laborLines.length + materialLines.length < MAX_DRAFT_CHILD_OPERATIONS
  let packageTotal: number | undefined
  let packageTotalError = ''
  if (step >= 3 && !activeCustom) {
    try {
      packageTotal = selectedPackages.reduce((total, p) => total + calculatePackageCost(p,
        quantityFor(p), rates, costInputs.time, costInputs.tax, costInputs.freight, laborLines, materialLines).total, 0)
    } catch (reason) { packageTotalError = reason instanceof Error ? reason.message : String(reason) }
  }
  const packagePaging = selectedPackages.length > pageSize && <div className="custom-line-actions">
    <button type="button" className="button secondary" disabled={currentPackagePage === 0}
      onClick={() => setPackagePage(currentPackagePage - 1)}>{language === 'fr' ? 'Précédent' : 'Previous'}</button>
    <span>{currentPackagePage + 1} / {Math.ceil(selectedPackages.length / pageSize)}</span>
    <button type="button" className="button secondary" disabled={(currentPackagePage + 1) * pageSize >= selectedPackages.length}
      onClick={() => setPackagePage(currentPackagePage + 1)}>{language === 'fr' ? 'Suivant' : 'Next'}</button>
  </div>
  const packageCostSummary = !activeCustom && <section className="form-card package-cost-summary">
    <h2>{language === 'fr' ? 'Coûts des forfaits sélectionnés' : 'Selected package costs'}</h2>
    <div className="package-overview-grid">
      {selectedPackages.slice(currentPackagePage * pageSize, (currentPackagePage + 1) * pageSize).map((p) => (
        <article className="package-overview-card" key={p.re_repairpackageid}>
          <h3>{p.re_packagenumber}</h3>
          <p>{localizePackage(p, language)}</p>
          <PackageCostDetails repairPackage={p} {...costInputs} quantity={quantityFor(p)} />
          {step === 3 && p.re_iscustompackage && <button className="button secondary small" onClick={() => {
            setActiveCustom(p.re_repairpackageid); setCustomError('')
          }}>{language === 'fr' ? 'Modifier les coûts CSTM' : 'Edit CSTM costs'}</button>}
        </article>
      ))}
    </div>
    {packagePaging}
    <dl className="package-cost-details package-combined-total">
      <dt>{language === 'fr' ? 'Coût total des forfaits' : 'Total package cost'}</dt>
      <dd>{packageTotal === undefined ? '—' : `${packageTotal.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`}</dd>
    </dl>
    {packageTotalError && <p className="error-box" role="alert">{packageTotalError}</p>}
    <p className="field-help">{language === 'fr'
      ? 'Tous les forfaits sélectionnés, taxe et fret inclus. Les ajouts sont comptés séparément, une seule fois.'
      : 'All selected packages, including tax and freight. Additions are counted separately, once.'}</p>
  </section>
  useEffect(() => {
    requestSection.current?.querySelector<HTMLElement>('[aria-current="step"]')?.focus()
  }, [step, requestSection])
  return (
    <section className="page-content" ref={requestSection}>
      <div className="page-heading new-heading">
        <div>
          <div className="eyebrow">CREATE · REQUEST WORKSPACE</div>
          <h1>{t.newTitle}</h1>
          <p>{t.newSubtitle}</p>
        </div>
        <span className="unsaved-badge">{exportDelivery ? `${submissionDeliveryMessage(exportDelivery.state, language)} ${draftNumber}` : submitted ? `${language === 'fr' ? 'Soumis' : 'Submitted'} ${draftNumber}` : draftVersion && !draftDirty ? `${dt.saved} ${draftNumber}` : t.notSaved}</span>
      </div>
      <div className="draft-toolbar">
        <div className="draft-secondary-actions">
          <button className="button tertiary" onClick={newDraft} disabled={draftBusy || !canStart}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            {dt.new}
          </button>
          {draftVersion && <button className="button tertiary" disabled={draftBusy || equipmentBulkBusy}
            onClick={() => void openDraft(draftId)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" /></svg>
            {dt.reload}
          </button>}
        </div>
        <button className="button primary draft-save-action" disabled={submitted || !!exportDelivery || draftBusy || equipmentBulkBusy || !canWork || !draftComplete}
          onClick={() => void saveDraft()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"><path d="m19 21 2-2V7l-4-4H5L3 5v14l2 2h14ZM7 3v6h10V3M7 21v-8h10v8" /></svg>
          {draftBusy ? dt.saving : dt.save}
        </button>
      </div>
      {draftVersion && <p className="field-help">{dt.locked}</p>}
      {exportDelivery && <p className="draft-notice" role="status">{submissionDeliveryMessage(exportDelivery.state, language)}
        {exportDelivery.workbookUrl && <> <a href={exportDelivery.workbookUrl} target="_blank" rel="noopener noreferrer">
          {language === 'fr' ? 'Ouvrir le classeur' : 'Open workbook'}
        </a></>}
      </p>}
      {submitted && !exportDelivery && <p className="draft-notice" role="status">{language === 'fr'
        ? 'Ce devis a été soumis et ne peut plus être modifié.'
        : 'This estimate has been submitted and is locked against editing.'}</p>}
      <fieldset className="draft-workspace" disabled={draftBusy || submitted || !!exportDelivery || equipmentBulkBusy}>

      <p className="draft-notice">{t.workbookAlignment}</p>
      <div className="stepper" aria-label={`${t.stepOf} ${step} / 5`}>
        {[t.stepOpportunity, t.stepEquipmentPackage, t.stepCosts, t.stepPricing, t.stepReview].map(
          (label, index) => {
            const number = index + 1
            return (
              <div
                className={`step ${number === step ? 'current' : ''} ${number < step ? 'complete' : ''}`}
                aria-current={number === step ? 'step' : undefined}
                tabIndex={-1}
                key={label}
              >
                <span className="step-number">
                  {number < step ? '✓' : number}
                </span>
                <span>{label}</span>
              </div>
            )
          },
        )}
      </div>

      {step <= 2 && (
        <div className={`form-layout ${step === 1 ? 'single-column' : ''}`}>
          <div className="form-main">
            <section className={`form-card ${step === 1 ? 'opportunity-card' : ''}`}>
              <div className="section-heading">
                <span className="section-icon">{step === 1 ? '01' : '02'}</span>
                <div>
                  <h2>{step === 1 ? t.stepOpportunity : t.equipment}</h2>
                  <p>{step === 1 ? t.opportunityHint : t.equipmentHint}</p>
                </div>
              </div>
              {step === 1 && <>
              <fieldset className="opportunity-group">
              <legend>{t.locationAssignment}</legend>
              <div className="input-grid">
                <div className="field-label">
                  <label htmlFor="estimate-title">{dt.title}<span className="required">*</span></label>
                  <input id="estimate-title" className="text-input" value={estimateTitle} maxLength={100}
                    aria-required="true" onChange={(event) => setEstimateTitle(event.target.value)} />
                  <p className="field-help">{language === 'fr'
                    ? 'Nom généré automatiquement ; vous pouvez le personnaliser.'
                    : 'Automatically generated; you can customize it.'}</p>
                </div>
                <div className="field-label">
                  <label htmlFor="draft-currency">{dt.currency}</label>
                  <input id="draft-currency" className="text-input" readOnly
                    value={currency ?? '—'} />
                  <p className="field-help">{language === 'fr'
                    ? 'Devise Dataverse du marché, confirmée par la succursale.'
                    : 'Dataverse market currency, confirmed by the selected Branch.'}</p>
                </div>
              </div>
              {draftReferenceError && <div className="error-box" role="alert">
                <span>{draftReferenceError}</span>
                <button className="button secondary" onClick={() => setReferenceAttempt((value) => value + 1)}>{t.retry}</button>
              </div>}
              {!draftReferences && !draftReferenceError && <p role="status">{t.loadingReferences}</p>}
              {branchLoading ? (
                <div className="inline-state" role="status">{t.loadBranches}</div>
              ) : branchError ? (
                <div className="error-box" role="alert">
                  <strong>{t.dataError}</strong>
                  <span>{branchError}</span>
                  <button className="text-button" onClick={() => void loadBranches()}>{t.retry}</button>
                </div>
              ) : (
                <>
                  <label className="field-label" htmlFor="branch-select">{t.branch}<span className="required">*</span></label>
                  <BranchSelect key={market} branches={marketBranches} value={branchId} disabled={Boolean(draftVersion)}
                    onChange={changeBranch} language={language} />
                  {marketBranches.length === 0 && <p className="field-help" role="status">{t.noMarketBranches}</p>}
                </>
              )}

              </fieldset>
              <fieldset className="opportunity-group">
              <legend>{language === 'fr' ? 'Coordonnées du client' : 'Customer details'}</legend>
              <CustomerMasterSelect key={`${market}:${branchId}:${selectedAccount?.id ?? 'no-account'}`}
                market={market} branchId={branchId} account={selectedAccount} contact={selectedContact}
                building={buildingName} onBuilding={setBuildingName}
                onAccount={onSelectAccount} onContact={onSelectContact} language={language} disabled={!canWork || draftBusy || submitted} />
              <div className="input-grid">
                <div className="field-label">
                  <label htmlFor="customer-email">{t.customerEmail}<span className="required" aria-hidden="true">*</span></label>
                  <input id="customer-email" type="email" className="text-input" maxLength={100}
                    required aria-required="true" readOnly value={customerEmail} />
                </div>
                <div className="field-label">
                  <label htmlFor="customer-phone">{t.customerPhone}</label>
                  <input id="customer-phone" type="tel" className="text-input" maxLength={100}
                    readOnly value={customerPhone} />
                </div>
              </div>
              <div className="request-options">
                {referenceError ? (
                  <div className="error-box" role="alert">
                    <strong>{t.dataError}</strong><span>{referenceError}</span>
                    <button className="button secondary" onClick={() => {
                      setReferenceError(''); setReferenceAttempt((value) => value + 1)
                    }}>{t.retry}</button>
                  </div>
                ) : !references ? <p role="status">{t.loadingReferences}</p> : (
                  <div className="input-grid">
                    {[
                      { id: 'equipment-type', label: t.equipmentType, value: equipmentTypeId, update: setEquipmentTypeId, options: references.equipmentTypes },
                      { id: 'job-type', label: t.jobType, value: jobTypeId, update: setJobTypeId, options: references.jobTypes },
                    ].map((field) => (
                      <div className="field-label" key={field.id}>
                        <label htmlFor={field.id}>{field.label}{field.id === 'equipment-type' && <span className="required">*</span>}</label>
                        <select id={field.id} className="text-input" aria-required={field.id === 'equipment-type'} value={field.value} onChange={(event) => field.update(event.target.value)}>
                          <option value="">{t.chooseReference}</option>
                          {field.options.map((option) => <option key={option.id} value={option.id}>
                            {language === 'fr' ? option.fr || option.en : option.en}
                          </option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="input-grid">
                <div className="field-label">
                  <label htmlFor="salesperson">{t.salesperson}</label>
                  <input id="salesperson" className="text-input" value={draftVersion ? savedSalesperson : session?.displayName ?? ''} readOnly />
                </div>
              </div>
              <div className="field-label">
                <label htmlFor="draft-province">{dt.province}<span className="required">*</span></label>
                <input id="draft-province" className="text-input system-field" disabled aria-required="true"
                  aria-describedby="draft-province-help" data-state-id={stateId}
                  value={(() => {
                    const state = draftReferences?.states.find((s) => s.id === stateId)
                    return state ? (language === 'fr' ? state.fr || state.en : state.en) : ''
                  })()}
                  placeholder={branchId && !draftReferences ? t.loadingReferences : ''} />
                <p id="draft-province-help" className={branchId && !stateId ? 'error-box compact' : 'field-help'}
                  role={branchId && !stateId ? 'alert' : undefined}>
                  {!branchId || stateId ? t.provinceFromBranch : t.missingProvince}
                </p>
              </div>
              {(!selectedAccount?.id || !selectedContact?.id || !customerEmail.trim()) &&
                <p id="customer-navigation-help" className="field-help" role="status">
                  {language === 'fr'
                    ? 'Vous pouvez continuer pour consulter les autres étapes. Sélectionnez un compte et un contact avec un courriel avant d’enregistrer ou de soumettre.'
                    : 'You can continue to review the other steps. Select an Account and Contact with an email before saving or submitting.'}
                </p>}
              </fieldset>
              <fieldset className="opportunity-group">
              <legend>{t.requestDetails}</legend>
              <RequestFields stage="request" language={language} value={requestInputs} onChange={updateRequestInput} />
              {canStart && <button className="button secondary opportunity-preset-action" type="button"
                onClick={onSaveOpportunity} disabled={draftBusy || equipmentBulkBusy}>
                {language === 'fr' ? 'Enregistrer comme modèle d’opportunité' : 'Save as Opportunity preset'}
              </button>}
              </fieldset>
              </>}
              {step === 2 && <>
              <label className="field-label search-label" htmlFor="equipment-search">{t.equipment}<span className="required">*</span></label>
              <EquipmentSelect results={equipmentResults} selectedNumbers={selectedEquipmentNumbers} onToggle={toggleEquipment}
                query={equipmentQuery} onQueryChange={changeEquipmentQuery} loading={equipmentLoading}
                disabled={!branchId} t={t} onAddUnlisted={addUnlistedEquipment} onPasteList={addEquipmentList} />
              <p className="field-help">
                {branchId ? t.searchHelp : t.branchRequired}
              </p>
              <EquipmentExcelUpload language={language} disabled={!branchId} busy={equipmentBulkBusy}
                onUpload={uploadEquipmentExcel} />

              {equipmentBulkBusy && <p className="field-help" role="status">{t.pasteChecking}</p>}
              {equipmentPasteResult && (
                <div className={`equipment-import-summary ${equipmentPasteResult.notFound.length || equipmentPasteResult.overLimit.length
                  ? 'warning-box' : 'paste-summary'}`} role="status">
                  <p className="equipment-import-total"><strong>{language === 'fr' ? 'Équipements ajoutés' : 'Equipment added'}</strong>
                    <span>{equipmentPasteResult.added.length}</span></p>
                  {([
                    [t.pasteNotFound, equipmentPasteResult.notFound],
                    [t.pasteOverLimit, equipmentPasteResult.overLimit],
                    [t.pasteAlreadySelected, equipmentPasteResult.alreadySelected],
                    [language === 'fr' ? 'Ajoutés comme non répertoriés' : 'Added as unlisted', equipmentPasteResult.unlisted ?? []],
                    [language === 'fr' ? 'Doublons ignorés' : 'Duplicate rows skipped', equipmentPasteResult.duplicates ?? []],
                  ] as const).filter(([, values]) => values.length > 0).map(([label, values]) => (
                    <div className="equipment-import-result" key={label}>
                      <strong>{label} <span>({values.length})</span></strong>
                      <span>{values.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}

              {equipmentError && (
                <div className="error-box compact" role="alert">
                  <strong>{t.dataError}</strong>
                  <span>{equipmentError}</span>
                </div>
              )}
              </>}
            </section>

            {step === 2 && selectedEquipment.length > 0 && (
              <section className="form-card selected-card">
                <div className="section-heading">
                  <span className="section-icon check-icon">✓</span>
                  <div>
                    <h2>{t.selectedEquipment}</h2>
                    <p>{selectedEquipment.length} {t.equipmentCount}</p>
                  </div>
                </div>
                <div className="selected-list">
                  {selectedEquipment.map((equipment, index) => (
                    <article className="equipment-card" key={equipment.id}>
                      <div className="equipment-index">{String(index + 1).padStart(2, '0')}</div>
                      <div className="equipment-info">
                        <div className="equipment-title">
                          <strong>{equipment.number}</strong>
                          {!equipment.matched && <span className="unbound-tag">{t.unbound}</span>}
                        </div>
                        {equipment.name && <span>{equipment.name}</span>}
                        <div className="equipment-meta">
                          {equipment.location && <span>{t.location}: {equipment.location}</span>}
                          {equipment.customer && <span>{t.customer}: {equipment.customer}</span>}
                          {equipment.oem && <span>{t.oem}: {equipment.oem}</span>}
                          {equipment.age !== undefined && <span>{t.age}: {equipment.age}</span>}
                        </div>
                      </div>
                      <button
                        className="icon-button remove-button"
                        aria-label={`${t.remove} ${equipment.number}`}
                        onClick={() => {
                          setSelectedEquipment((current) => current.filter((item) => item.id !== equipment.id))
                          setSelectedPackages((current) => current.map((p) => ({ ...p,
                            equipmentNumbers: p.equipmentNumbers?.filter((number) => number !== equipment.number) })))
                        }}
                      >
                        ×
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          {step === 2 && <aside className="form-aside">
            <div className="aside-card">
              <span className="aside-overline">{t.liveData}</span>
              <h3>{t.equipment}</h3>
              <p>{t.equipmentNote}</p>
              <div className="aside-divider" />
              <div className="aside-stat">
                <span>{t.selectedEquipment}</span>
                <strong>{selectedEquipment.length}</strong>
              </div>
            </div>
            <div className="aside-note">
              <span className="note-icon">i</span>
              <p>{t.costsHint}</p>
            </div>
          </aside>}
        </div>
      )}

      {step === 2 && (
        <div className="form-layout">
          <div className="form-main">
            <section className="form-card">
              <div className="section-heading">
                <span className="section-icon">02</span>
                <div>
                  <h2>{t.packagesTitle}</h2>
                  <p>{t.packagesHint}</p>
                </div>
              </div>
              <label className="field-label" htmlFor="package-search">{t.packagesTitle}</label>
              <PackageSelect packages={packageResults} selectedIds={selectedPackageIds} onToggle={choosePackage}
                language={language} t={t} loading={packageLoading} disabled={!selectedBranch?._re_country_value} />
              <p className="field-help">{t.packageSearchHelp}</p>
              {rateResult?.branchId === branchId && rateResult.error && <div role="alert" className="error-box">
                {rateResult.error}<button className="button secondary" onClick={() => setRateAttempt((n) => n + 1)}>{t.retry}</button>
              </div>}
              {!selectedBranch?._re_country_value && <p className="error-box" role="alert">{t.missingCountry}</p>}
              {packageError && (
                <div className="error-box compact" role="alert">
                  <strong>{t.dataError}</strong>
                  <span>{packageError}</span>
                  <button type="button" className="button small secondary" onClick={retryPackages}>{t.retry}</button>
                </div>
              )}
            </section>
            {selectedPackages.length > 0 && (
              <section className="form-card selected-card">
                <div className="section-heading">
                  <span className="section-icon check-icon">✓</span>
                  <div>
                    <h2>{t.selectedPackages}</h2>
                    <p>{selectedPackages.length}</p>
                  </div>
                </div>
                <div className="selected-list">
                  {selectedPackages.slice(currentPackagePage * pageSize, (currentPackagePage + 1) * pageSize).map((repairPackage) => (
                    <div className="selected-package-group" key={repairPackage.re_repairpackageid}>
                    <details className="package-equipment-selection">
                      <summary>{repairPackage.re_packagenumber} — {language === 'fr' ? 'Personnaliser les équipements' : 'Customize equipment'} — {quantityFor(repairPackage)} / {selectedEquipment.length}</summary>
                      <button type="button" className="button secondary" onClick={() => setSelectedPackages((current) =>
                        current.map((p) => p.re_repairpackageid === repairPackage.re_repairpackageid ? { ...p, equipmentNumbers: undefined } : p))}>
                        {language === 'fr' ? 'Tous les équipements' : 'All equipment'}
                      </button>
                      {selectedEquipment.map((unit) => <label key={unit.number}>
                        <input type="checkbox" checked={packageEquipmentNumbers(repairPackage, selectedEquipment).includes(unit.number)}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setSelectedPackages((current) => current.map((p) => {
                              if (p.re_repairpackageid !== repairPackage.re_repairpackageid) return p
                              const numbers = packageEquipmentNumbers(p, selectedEquipment)
                              return { ...p, equipmentNumbers: checked ? [...numbers, unit.number] : numbers.filter((number) => number !== unit.number) }
                            }))
                          }} /> {unit.number}
                      </label>)}
                      {!validPackageEquipment(repairPackage, selectedEquipment) && <p role="alert" className="error-box">
                        {language === 'fr' ? 'Sélectionnez au moins un équipement et corrigez les équipements retirés.' : 'Select at least one equipment unit and resolve any removed equipment.'}
                      </p>}
                    </details>
                    <EquipmentPackageCosts equipment={selectedEquipment.filter((unit) => packageEquipmentNumbers(repairPackage, selectedEquipment).includes(unit.number))}
                      repairPackage={repairPackage} {...costInputs} />
                    <article className="equipment-card selected-package-card">
                      <div className="equipment-index">PK</div>
                      <div className="equipment-info selected-package-description">
                        <div className="equipment-title">
                          <strong>{repairPackage.re_packagenumber}</strong>
                          <span>{repairPackage.re_iscustompackage ? 'CSTM' : repairPackage.re_istimematerial ? 'T&M' : 'PSR'}</span>
                        </div>
                        <span>{localizePackage(repairPackage, language)}</span>
                        <div className="package-scope">
                          <small className="package-scope-label">{t.scopeOfWork}</small>
                          <p>{localizeScope(repairPackage, language) || t.noScope}</p>
                        </div>
                        {repairPackage.re_iscustompackage && <button className="button secondary small" onClick={() => {
                          setActiveCustom(repairPackage.re_repairpackageid); setCustomError(''); setStep(3)
                        }}>{language === 'fr' ? 'Modifier les coûts CSTM' : 'Edit CSTM costs'}</button>}
                      </div>
                      <div className="selected-package-pricing">
                        <PackageCostDetails repairPackage={repairPackage} {...costInputs} quantity={quantityFor(repairPackage)} />
                      </div>
                      <button
                        className="icon-button remove-button selected-package-remove"
                        aria-label={`${t.remove} ${repairPackage.re_packagenumber}`}
                        onClick={() => setSelectedPackages((current) => current.filter((item) => item.re_repairpackageid !== repairPackage.re_repairpackageid))}
                      >
                        ×
                      </button>
                    </article>
                    </div>
                  ))}
                </div>
                {packagePaging}
              </section>
            )}
          </div>
          <aside className="form-aside">
            <div className="aside-card">
              <span className="aside-overline">{marketName || t.liveData}</span>
              <h3>{t.selectedPackages}</h3>
              <p>{t.packageLimit}</p>
              <div className="aside-divider" />
              <div className="aside-stat">
                <span>{t.selectedPackages}</span>
                <strong>{selectedPackages.length}</strong>
              </div>
              <div className="aside-divider" />
              <div className="aside-stat">
                <span>{t.selectedEquipment}</span>
                <strong>{selectedEquipment.length}</strong>
              </div>
            </div>
            <div className="aside-note">
              <span className="note-icon">i</span>
              <p>{t.costsHint}</p>
            </div>
          </aside>
        </div>
      )}

      {(step === 3 || step === 4) && (
        <div className="form-layout single-column">
          <div className="form-main">
            {packageCostSummary}
            {!(step === 3 && activeCustom && hasCustom) && <section className="form-card">
              <div className="section-heading">
                <span className="section-icon">{step === 3 ? '03' : '04'}</span>
                <div>
                  <h2>{step === 3 ? t.costsTitle : t.proposalPrice}</h2>
                  <p>{step === 3 ? t.costsHint : t.pricingHint}</p>
                </div>
              </div>
              <RequestFields stage={step === 3 ? 'cost' : 'pricing'} language={language}
                value={requestInputs} onChange={updateRequestInput} currency={currency}
                custom={hasCustom || (step !== 3 && Number(requestInputs.re_konesparessalespricevk13) > 0)} />
              <p className="draft-notice">{step === 3 ? t.costsUnavailable : t.pricingHint}</p>
            </section>}
            {rateResult?.branchId === branchId && rateResult.error && <div role="alert" className="error-box">
              {rateResult.error}<button className="button secondary" onClick={() => setRateAttempt((n) => n + 1)}>{t.retry}</button>
            </div>}
            {step === 3 && ((activeCustom && hasCustom) || (!hasCustom && (laborLines.length > 0 || materialLines.length > 0))) &&
              <CustomCostLines language={language} market={market} labor={laborLines} materials={materialLines}
                requestInputs={requestInputs} updateRequestInput={updateRequestInput}
                setLabor={setLaborLines} setMaterials={setMaterialLines} enabled={hasCustom} canAdd={canAdd} readOnly={draftBusy}
                packages={customPackages.map((p) => ({ id: p.re_repairpackageid, name: p.re_packagenumber,
                  materialBeforeMarkup: p.re_materialbeforemarkup, material: p.re_materialmisctaxcost }))}
                activePackageId={activeCustom} currency={currency} />}
            {step === 3 && customValidation && <p role="alert" className="error-box">{customValidation}</p>}
            {step === 3 && customError && <p role="alert" className="error-box">{customError}</p>}
            {step === 4 && (laborLines.length > 0 || materialLines.length > 0) &&
              <p>{language === 'fr' ? 'Lignes personnalisées' : 'Custom lines'}: {laborLines.length} / {materialLines.length}</p>}
            {step === 4 && localPreview}
            {step === 4 && <PricingSummary id={draftId} version={draftVersion} dirty={draftDirty}
              language={language} currencies={draftReferences?.currencies ?? []} submitted={submitted}
              calculate={saveDraft} calculating={draftBusy} calculationError={draftError}
              canCalculate={canWork && draftComplete} />}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="form-layout single-column">
          <div className="form-main">
            {packageCostSummary}
            {localPreview}
            <PricingSummary id={draftId} version={draftVersion} dirty={draftDirty}
              language={language} currencies={draftReferences?.currencies ?? []} submitted={submitted}
              calculate={saveDraft} calculating={draftBusy} calculationError={draftError}
              canCalculate={canWork && draftComplete} />
            {(hasCustom || laborLines.length > 0 || materialLines.length > 0) &&
              <CustomCostLines language={language} market={market} labor={laborLines} materials={materialLines}
                requestInputs={requestInputs} updateRequestInput={updateRequestInput}
                setLabor={setLaborLines} setMaterials={setMaterialLines} enabled={hasCustom} canAdd={false} readOnly
                packages={customPackages.map((p) => ({ id: p.re_repairpackageid, name: p.re_packagenumber,
                  materialBeforeMarkup: p.re_materialbeforemarkup, material: p.re_materialmisctaxcost }))} currency={currency} />}
            <section className="form-card">
              <div className="section-heading">
                <span className="section-icon">05</span>
                <div>
                  <h2>{t.reviewTitle}</h2>
                  <p>{t.customerHint}</p>
                </div>
                </div>
              <dl className="summary-grid customer-summary">
                  {[[language === 'fr' ? 'Numéro de compte' : 'Account number', selectedAccount?.number ?? ''],
                    [language === 'fr' ? 'Nom du compte' : 'Account name', selectedAccount?.name ?? ''],
                    [t.customerName, customerName], [t.buildingName, buildingName],
                    [t.customerEmail, customerEmail], [t.customerPhone, customerPhone]].map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
                ))}
              </dl>
              <h3>{t.partnerTitle}</h3>
              <RequestFields stage="partner" language={language} value={requestInputs} onChange={updateRequestInput} />
            </section>
            <section className="form-card summary-card">
              <div className="summary-heading">
                <div>
                  <span className="aside-overline">{marketName || t.liveData}</span>
                  <h2>{t.selectedEquipment} &amp; {t.selectedPackages}</h2>
                </div>
                <span className="preview-badge">{t.previewOnly}</span>
              </div>
              <div className="summary-grid">
                <div>
                  <span className="summary-label">{t.branch}</span>
                  <strong>{selectedBranch?.re_branchname ?? '—'}</strong>
                </div>
                <div>
                  <span className="summary-label">{t.selectedCount}</span>
                  <strong>{selectedEquipment.length}</strong>
                </div>
                <div>
                  <span className="summary-label">{t.selectedPackages}</span>
                  <strong>{selectedPackages.length}</strong>
                </div>
              </div>
              <ul>
                {selectedEquipment.map((equipment) => <li key={equipment.id}>
                  {equipment.number}{equipment.name ? ` — ${equipment.name}` : ''}
                  {!equipment.matched ? ` (${t.unbound})` : ''}
                </li>)}
                {selectedPackages.slice(currentPackagePage * pageSize, (currentPackagePage + 1) * pageSize).map((repairPackage) => <li key={repairPackage.re_repairpackageid}>
                  {repairPackage.re_packagenumber} — {localizePackage(repairPackage, language)}
                </li>)}
              </ul>
              {packagePaging}
              {(['request', 'cost', 'pricing'] as const).map((stage) => (
                <details key={stage}>
                  <summary>{stage === 'request' ? t.requestDetails : stage === 'cost' ? t.stepCosts : t.stepPricing}</summary>
                  <RequestFields stage={stage} language={language} value={requestInputs} onChange={updateRequestInput}
                    custom={hasCustom || (stage !== 'cost' && Number(requestInputs.re_konesparessalespricevk13) > 0)} currency={currency} readOnly />
                </details>
              ))}
              <p className="draft-notice">{dt.note}</p>
            </section>
          </div>
          <aside className="form-aside">
            <div className="aside-card">
              <span className="aside-overline">{t.readyNext}</span>
              <h3>{draftVersion && !draftDirty ? dt.saved : t.notSaved}</h3>
              <p>{dt.note}</p>
            </div>
          </aside>
        </div>
      )}

      <div className="form-footer">
        <button className="button tertiary" onClick={() => {
          setActiveCustom(undefined); setCustomError('')
          if (step === 1) onDashboard()
          else setStep((current) => current - 1)
        }}>
          {t.back}
        </button>
        <div className="footer-actions">
          {step < 5 ? (
            <button
              className="button primary"
              onClick={() => {
                if (step === 3 && activeCustom) { finishCustomPackage(); return }
                if (step === 3 && customValidation) { setCustomError(customValidation); return }
                const inputs = requestSection.current?.querySelectorAll<HTMLInputElement>('input')
                if (inputs && !Array.from(inputs).every((input) =>
                  step === 1 && input.id === 'customer-email' || input.reportValidity())) return
                setActiveCustom(undefined); setCustomError('')
                setStep((current) => current + 1)
              }}
              aria-describedby={step === 1 && (!selectedAccount?.id || !selectedContact?.id || !customerEmail.trim())
                ? 'customer-navigation-help' : undefined}
              disabled={step === 1 ? !branchId || !buildingName.trim() || !equipmentTypeId
                : step === 2 ? selectedEquipment.length === 0 || selectedPackages.length === 0 || !assignmentValid : false}
            >
              {step === 3 && activeCustom
                ? language === 'fr' ? 'Calculer et retourner aux forfaits' : 'Calculate and return to packages'
                : step === 1 ? t.nextEquipment : t.continue}
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button className="button primary" disabled={submitted || draftBusy || !draftComplete}
              onClick={() => void saveDraft(true)} title={draftComplete ? undefined : dt.required}>
              {submitted ? language === 'fr' ? 'Soumis' : 'Submitted'
                : draftBusy ? language === 'fr' ? 'Soumission…' : 'Submitting…'
                  : language === 'fr' ? 'Soumettre le devis' : 'Submit estimate'}
            </button>
          )}
        </div>
      </div>
      </fieldset>
    </section>
  )
}
