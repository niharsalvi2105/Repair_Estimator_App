import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getBranches,
  getRequestReferences,
  getDraftReferences,
  type DraftReferences,
  searchEquipment,
  searchStandardPackages,
  type Branch,
  type Equipment,
  type RepairPackage,
  type ReferenceOption,
} from './data/repairEstimatorRepository'
import './App.css'
import { EstimateList } from './EstimateList'
import { PricingSummary } from './PricingSummary'
import { DashboardMetrics } from './DashboardMetrics'
import { loadSession, type AppSession } from './data/sessionRepository'
import { RequestFields, type RequestInputs } from './RequestFields'
import type { Market } from './data/estimateQuery'
import { useUserPreferences } from './useUserPreferences'
import { BranchSelect } from './BranchSelect'
import { UserAvatar } from './UserAvatar'
import koneLogo from './assets/kone-logo.jpg?inline'
import { draftOperation, draftInputs, type DraftRecord } from './data/draftRepository'

type Language = 'en' | 'fr'
type View = 'estimates' | 'requests' | 'new'
type SelectedEquipment = {
  id: string
  number: string
  name: string
  location: string
  customer: string
  oem: string
  age?: number
  matched: boolean
}

const copy = {
  en: {
    appName: 'Repair Estimator',
    workspace: 'KTOC PSR ESTIMATOR',
    estimates: 'Dashboard',
    newEstimate: 'New Request',
    repairRequests: 'Repair Requests',
    estimatorNav: 'Estimator',
    pricingNav: 'Pricing & Margin',
    approvalsNav: 'Approvals',
    quotesNav: 'Quotes',
    masterDataNav: 'Master Data',
    reportsNav: 'Reports',
    settingsNav: 'Settings',
    comingSoon: 'This workspace is not available yet.',
    checkingAccess: 'Checking your Power Apps identity and Dataverse access...',
    developmentAdminNotice: 'Local testing: Admin UI override is active. Dataverse permissions still apply. Production builds ignore this override.',
    accessError: 'Could not verify your access.',
    noRole: 'Access is not configured. Ask your administrator to assign Repair Estimator - Estimator or Repair Estimator - Admin in this environment.',
    noRead: 'Your app role does not grant permission to read estimates. Contact your administrator.',
    noCreate: 'You have read-only estimate access. Request creation requires the Dataverse Create privilege.',
    estimatorRole: 'Estimator',
    adminRole: 'Admin',
    unverifiedRole: 'Access not verified',
    metricsPending: 'Dashboard aggregates are not connected yet. Use Repair Requests to view live records.',
    viewRequests: 'View requests',
    requestSearch: 'Search requests by ID, customer or building (starts with)',
    searchAction: 'Search',
    equipmentType: 'Equipment type',
    jobType: 'Job type',
    chooseReference: 'Select an option',
    loadingReferences: 'Loading request options...',
    signIn: 'Signed in',
    dashboardTitle: 'Operations Dashboard',
    dashboardSubtitle: 'Manage repair estimates and create new service requests.',
    openRequests: 'Open Requests',
    pendingApprovals: 'Pending Approvals',
    quotesSent: 'Quotes Sent',
    averageMargin: 'Average Margin',
    dataPending: 'Available when estimate records are connected.',
    requestStatus: 'Request Status',
    requestStatusHint: 'Current repair request distribution',
    repairTypes: 'Repair Type Distribution',
    repairTypesHint: 'Requests by work type',
    recentRequests: 'Recent Repair Requests',
    recentRequestsHint: 'Latest activity in your workspace',
    noDashboardData: 'Request data will appear here when Dataverse estimates are connected.',
    emptyTitle: 'No repair requests yet',
    emptyText:
      'Start a repair request to begin. Your saved requests will appear here when estimate records are connected.',
    startEstimate: 'New repair request',
    newTitle: 'New Repair Request',
    newSubtitle:
      'Capture the opportunity, select equipment and packages, enter cost inputs, then review pricing and customer details.',
    stepOpportunity: 'Opportunity details',
    stepEquipmentPackage: 'Equipment & packages',
    stepCosts: 'Cost inputs',
    stepPricing: 'Pricing & margin',
    requestDetails: 'Repair request details',
    salesperson: 'Salesperson (signed-in user)',
    locationAssignment: 'Location & assignment',
    opportunityHint: 'Estimator header inputs for the selected market. Supervisor is optional; customer contact details are confirmed at review.',
    nextEquipment: 'Continue to equipment & packages',
    costsHint: 'Inputs only. No costs, margins or incentives are calculated or saved in this browser.',
    pricingHint: 'Save the draft to calculate pricing in Dataverse. Saved results appear below; an entered selling price is not an approved quote.',
    equipmentNote: 'Equipment names are resolved from Dataverse. Unlisted numbers remain explicitly unbound.',
    costsTitle: 'Standard package cost inputs',
    costsUnavailable: 'Package labor, material, tax and freight totals require verified server calculation. Enter percentages as displayed in Excel (e.g. 5 for 5%); defaults are not loaded. Custom/T&M line entry is not implemented yet.',
    proposalPrice: 'Proposal pricing',
    partnerTitle: 'Partner information & CTT notes',
    selectedCount: 'Equipment quantity (from selected units)',
    workbookAlignment: 'Saved standard-package pricing is calculated in Dataverse. Excel reconciliation is still required; custom/T&M and submission are not connected.',
    branchChangeWarning: 'Changing branch removes the selected equipment and packages. Continue?',
    missingCountry: 'This branch has no country lookup. Package search cannot run; ask an administrator to correct the branch data.',
    stepEquipment: 'Equipment',
    stepPackages: 'Packages',
    stepReview: 'Review',
    stepOf: 'Step',
    branch: 'Branch',
    chooseBranch: 'Choose a branch',
    equipment: 'Equipment',
    equipmentHint:
      'Search by equipment number or name. Results are limited to the selected branch.',
    equipmentSearch: 'Search equipment number or name',
    searchHelp: 'Enter at least 3 characters to search Dataverse.',
    searching: 'Searching Dataverse...',
    noEquipment: 'No matching equipment found.',
    selectEquipment: 'Select',
    selectedEquipment: 'Selected equipment',
    equipmentCount: 'equipment selected',
    unlisted: 'Add as unlisted equipment',
    unbound: 'Not found in equipment master',
    location: 'Location',
    customer: 'Customer',
    oem: 'Manufacturer',
    age: 'Age',
    remove: 'Remove',
    continue: 'Continue',
    back: 'Back',
    packagesTitle: 'Select standard packages',
    packagesHint:
      'Choose up to three packages. Hours and materials scale with the equipment count. Save the draft to view server pricing in Pricing & Margin or Review.',
    packageSearch: 'Search package number or name',
    packageSearchHelp: 'Enter at least 2 characters to search the package catalog.',
    searchingPackages: 'Searching package catalog...',
    noPackages: 'No matching active standard packages found.',
    selectedPackages: 'Selected packages',
    addPackage: 'Add package',
    packageLimit: 'You can select up to 3 standard packages.',
    reviewTitle: 'Review request details',
    customerName: 'Customer name',
    customerEmail: 'Customer email',
    customerPhone: 'Customer phone',
    buildingName: 'Building name',
    customerHint:
      'Confirm customer and building details before proceeding. These values are not saved yet.',
    draftUnavailable:
      'Draft saving is not connected yet. The app will not claim this request was saved.',
    readyNext: 'Next implementation step',
    readyNextText:
      'Connect the approved estimate creation and server-side defaults before enabling draft save or submission.',
    dataError: 'Could not load data from Dataverse.',
    retry: 'Retry',
    branchRequired: 'Choose a branch to search equipment.',
    loadBranches: 'Loading branches...',
    liveData: 'Dataverse workspace',
    notSaved: 'Not saved',
    previewOnly: 'Preview only',
    language: 'Language',
    market: 'Market',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    theme: 'Theme',
    systemTheme: 'System',
    preferencesLoading: 'Loading your saved preferences...',
    preferencesSaving: 'Saving preferences...',
    preferencesError: 'Could not load or save your preferences.',
    preferencesUnsaved: 'Your current preferences are not saved.',
    marketChangeWarning: 'Changing market clears the branch, equipment and package selections for this unsaved request. Other entered details are kept. Continue?',
    noMarketBranches: 'No active branches are available for this market with your Dataverse permissions.',
    user: 'KONE workspace',
  },
  fr: {
    appName: 'Estimateur de réparations',
    workspace: 'ESTIMATEUR KTOC PSR',
    estimates: 'Tableau de bord',
    newEstimate: 'Nouvelle demande',
    repairRequests: 'Demandes de réparation',
    estimatorNav: 'Estimateur',
    pricingNav: 'Prix et marge',
    approvalsNav: 'Approbations',
    quotesNav: 'Devis',
    masterDataNav: 'Données principales',
    reportsNav: 'Rapports',
    settingsNav: 'Paramètres',
    comingSoon: 'Cet espace de travail n’est pas encore disponible.',
    checkingAccess: 'Vérification de votre identité Power Apps et de vos droits Dataverse…',
    developmentAdminNotice: 'Test local : le mode Admin temporaire est actif. Les droits Dataverse restent applicables. Ce mode est ignoré dans les versions de production.',
    accessError: 'Impossible de vérifier vos droits.',
    noRole: 'Accès non configuré. Demandez à votre administrateur d’attribuer le rôle Repair Estimator - Estimator ou Repair Estimator - Admin dans cet environnement.',
    noRead: 'Votre rôle ne permet pas de consulter les estimations. Contactez votre administrateur.',
    noCreate: 'Vous disposez d’un accès en lecture seule. La création de demandes nécessite le privilège de création Dataverse.',
    estimatorRole: 'Estimateur',
    adminRole: 'Admin',
    unverifiedRole: 'Accès non vérifié',
    metricsPending: 'Les indicateurs ne sont pas encore connectés. Consultez les demandes pour voir les données réelles.',
    viewRequests: 'Voir les demandes',
    requestSearch: 'Rechercher par début de numéro, client ou immeuble',
    searchAction: 'Rechercher',
    equipmentType: 'Type d’équipement',
    jobType: 'Type de travail',
    chooseReference: 'Choisir une option',
    loadingReferences: 'Chargement des options…',
    signIn: 'Connecté',
    dashboardTitle: 'Tableau de bord des opérations',
    dashboardSubtitle: 'Gérez les estimations de réparation et créez des demandes de service.',
    openRequests: 'Demandes ouvertes',
    pendingApprovals: 'Approbations en attente',
    quotesSent: 'Devis envoyés',
    averageMargin: 'Marge moyenne',
    dataPending: 'Disponible lorsque les estimations seront connectées.',
    requestStatus: 'État des demandes',
    requestStatusHint: 'Répartition actuelle des demandes de réparation',
    repairTypes: 'Répartition par type de réparation',
    repairTypesHint: 'Demandes par type de travail',
    recentRequests: 'Demandes de réparation récentes',
    recentRequestsHint: 'Activité récente dans votre espace de travail',
    noDashboardData: 'Les demandes apparaîtront ici lorsque les estimations Dataverse seront connectées.',
    emptyTitle: 'Aucune demande de réparation',
    emptyText:
      'Commencez une demande de réparation. Vos demandes enregistrées apparaîtront ici lorsque les enregistrements seront connectés.',
    startEstimate: 'Nouvelle demande de réparation',
    newTitle: 'Nouvelle demande de réparation',
    newSubtitle:
      'Saisissez l’opportunité, sélectionnez les équipements et forfaits, puis vérifiez les coûts, le prix et les coordonnées.',
    stepOpportunity: 'Détails de l’opportunité',
    stepEquipmentPackage: 'Équipements et forfaits',
    stepCosts: 'Coûts',
    stepPricing: 'Prix et marge',
    requestDetails: 'Détails de la réparation',
    salesperson: 'Vendeur (utilisateur connecté)',
    locationAssignment: 'Emplacement et affectation',
    opportunityHint: 'En-tête de l’estimateur pour le marché sélectionné. Le superviseur est facultatif ; les coordonnées du client sont confirmées à la vérification.',
    nextEquipment: 'Continuer vers les équipements et forfaits',
    costsHint: 'Saisie uniquement. Aucun coût, marge ou incitatif n’est calculé ou enregistré dans le navigateur.',
    pricingHint: 'Enregistrez le brouillon pour calculer les prix dans Dataverse. Les résultats enregistrés apparaissent ci-dessous ; le prix saisi n’est pas un devis approuvé.',
    equipmentNote: 'Les noms des équipements proviennent de Dataverse. Les numéros non répertoriés restent sans correspondance.',
    costsTitle: 'Coûts supplémentaires du forfait standard',
    costsUnavailable: 'Les totaux de main-d’œuvre, matériaux, taxes et fret nécessitent le calcul serveur vérifié. Saisissez les pourcentages comme dans Excel (ex. 5 pour 5 %) ; les valeurs par défaut ne sont pas chargées. La saisie personnalisée/T&M n’est pas encore implémentée.',
    proposalPrice: 'Prix de la proposition',
    partnerTitle: 'Partenaires et notes CTT',
    selectedCount: 'Quantité d’équipements (unités sélectionnées)',
    workbookAlignment: 'Les prix des forfaits standards enregistrés sont calculés dans Dataverse. La comparaison Excel reste nécessaire ; les coûts personnalisés/T&M et l’envoi ne sont pas connectés.',
    branchChangeWarning: 'Changer de succursale supprime les équipements et forfaits sélectionnés. Continuer ?',
    missingCountry: 'Cette succursale n’a pas de pays associé. La recherche de forfaits est impossible ; contactez un administrateur.',
    stepEquipment: 'Équipement',
    stepPackages: 'Forfaits',
    stepReview: 'Vérification',
    stepOf: 'Étape',
    branch: 'Succursale',
    chooseBranch: 'Choisir une succursale',
    equipment: 'Équipement',
    equipmentHint:
      'Recherchez par numéro ou nom d’équipement. Les résultats sont limités à la succursale choisie.',
    equipmentSearch: 'Rechercher par numéro ou nom',
    searchHelp: 'Saisissez au moins 3 caractères pour rechercher dans Dataverse.',
    searching: 'Recherche dans Dataverse…',
    noEquipment: 'Aucun équipement correspondant.',
    selectEquipment: 'Sélectionner',
    selectedEquipment: 'Équipement sélectionné',
    equipmentCount: 'équipement(s) sélectionné(s)',
    unlisted: 'Ajouter comme équipement non répertorié',
    unbound: 'Introuvable dans le référentiel',
    location: 'Emplacement',
    customer: 'Client',
    oem: 'Fabricant',
    age: 'Âge',
    remove: 'Retirer',
    continue: 'Continuer',
    back: 'Retour',
    packagesTitle: 'Choisir les forfaits standard',
    packagesHint:
      'Choisissez jusqu’à trois forfaits. Les heures et matériaux varient selon le nombre d’équipements. Enregistrez le brouillon pour voir les prix dans Prix et marge ou Vérification.',
    packageSearch: 'Rechercher par numéro ou nom de forfait',
    packageSearchHelp: 'Saisissez au moins 2 caractères pour rechercher le catalogue.',
    searchingPackages: 'Recherche dans le catalogue…',
    noPackages: 'Aucun forfait standard actif correspondant.',
    selectedPackages: 'Forfaits sélectionnés',
    addPackage: 'Ajouter le forfait',
    packageLimit: 'Vous pouvez choisir jusqu’à 3 forfaits standard.',
    reviewTitle: 'Vérifier les détails de la demande',
    customerName: 'Nom du client',
    customerEmail: 'Courriel du client',
    customerPhone: 'Téléphone du client',
    buildingName: 'Nom de l’immeuble',
    customerHint:
      'Confirmez les renseignements du client et de l’immeuble. Ces valeurs ne sont pas encore enregistrées.',
    draftUnavailable:
      'L’enregistrement du brouillon n’est pas encore connecté. L’application ne prétendra pas que la demande est enregistrée.',
    readyNext: 'Prochaine étape d’implémentation',
    readyNextText:
      'Connecter la création d’estimation approuvée et les valeurs par défaut côté serveur avant d’activer l’enregistrement ou l’envoi.',
    dataError: 'Impossible de charger les données Dataverse.',
    retry: 'Réessayer',
    branchRequired: 'Choisissez une succursale pour rechercher l’équipement.',
    loadBranches: 'Chargement des succursales…',
    liveData: 'Espace de travail Dataverse',
    notSaved: 'Non enregistré',
    previewOnly: 'Aperçu seulement',
    language: 'Langue',
    market: 'Marché',
    darkMode: 'Mode sombre',
    lightMode: 'Mode clair',
    theme: 'Thème',
    systemTheme: 'Système',
    preferencesLoading: 'Chargement de vos préférences...',
    preferencesSaving: 'Enregistrement des préférences...',
    preferencesError: 'Impossible de charger ou d’enregistrer vos préférences.',
    preferencesUnsaved: 'Vos préférences actuelles ne sont pas enregistrées.',
    marketChangeWarning: 'Changer de marché efface la succursale, les équipements et les forfaits de cette demande non enregistrée. Les autres données sont conservées. Continuer ?',
    noMarketBranches: 'Aucune succursale active n’est accessible pour ce marché avec vos autorisations Dataverse.',
    user: 'Espace KONE',
  },
} satisfies Record<Language, Record<string, string>>

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected Dataverse error.'
}

function localizePackage(
  repairPackage: Pick<RepairPackage, 're_packagenameen' | 're_packagenamefr'>,
  language: Language,
): string {
  if (language === 'fr' && repairPackage.re_packagenamefr) {
    return repairPackage.re_packagenamefr
  }
  return repairPackage.re_packagenameen
}

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    new: 'M12 5v14 M5 12h14',
    requests: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
    estimator: 'M5 3h14v18H5z M8 7h8 M8 12h1 M12 12h1 M16 12h0 M8 16h1 M12 16h1 M16 16h0',
    pricing: 'M16 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7 M12 3v18',
    quotes: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5',
    approvals: 'M4 12l5 5L20 6',
    data: 'M4 4h16v16H4z M4 9h16 M4 14h16 M10 4v16',
    reports: 'M4 3v18h17 M8 17v-5 M13 17V7 M18 17V4',
    settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  }
  return (
    <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

function App() {
  const [market, setMarket] = useState<Market>(126110000)
  const [systemDarkMode, setSystemDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [view, setView] = useState<View>('estimates')
  const [searchInput, setSearchInput] = useState('')
  const [requestSearch, setRequestSearch] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchLoading, setBranchLoading] = useState(true)
  const [branchError, setBranchError] = useState('')
  const [branchId, setBranchId] = useState('')
  const [equipmentQuery, setEquipmentQuery] = useState('')
  const [equipmentResults, setEquipmentResults] = useState<Equipment[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [equipmentError, setEquipmentError] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState<
    SelectedEquipment[]
  >([])
  const [packageQuery, setPackageQuery] = useState('')
  const [packageResults, setPackageResults] = useState<RepairPackage[]>([])
  const [packageLoading, setPackageLoading] = useState(false)
  const [packageError, setPackageError] = useState('')
  const [selectedPackages, setSelectedPackages] = useState<Omit<RepairPackage, 're_effectivefrom' | 're_effectiveto'>[]>([])
  const [step, setStep] = useState(1)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [buildingName, setBuildingName] = useState('')
  const [session, setSession] = useState<AppSession>()
  const preferences = useUserPreferences(session)
  const language = preferences.language
  const darkMode = preferences.theme === 'dark' || (preferences.theme === 'system' && systemDarkMode)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionAttempt, setSessionAttempt] = useState(0)
  const [references, setReferences] = useState<{ equipmentTypes: ReferenceOption[]; jobTypes: ReferenceOption[] }>()
  const [referenceError, setReferenceError] = useState('')
  const [referenceAttempt, setReferenceAttempt] = useState(0)
  const [equipmentTypeId, setEquipmentTypeId] = useState('')
  const [jobTypeId, setJobTypeId] = useState('')
  const [requestInputs, setRequestInputs] = useState<RequestInputs>({})
  const [draftReferences, setDraftReferences] = useState<DraftReferences>()
  const [draftReferenceError, setDraftReferenceError] = useState('')
  const [stateId, setStateId] = useState('')
  const [estimateTitle, setEstimateTitle] = useState('')
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID())
  const [draftVersion, setDraftVersion] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [draftNotice, setDraftNotice] = useState('')
  const [savedSalesperson, setSavedSalesperson] = useState('')
  const [pricingUnavailable, setPricingUnavailable] = useState(false)
  const draftInFlight = useRef(false)
  const requestSection = useRef<HTMLElement>(null)
  function updateRequestInput(key: keyof RequestInputs, value: string) {
    setRequestInputs((current) => ({ ...current, [key]: value }))
  }

  const t = copy[language]
  const roleLabel = session?.role === 'admin' ? t.adminRole
    : session?.role === 'estimator' ? t.estimatorRole : t.unverifiedRole
  const canStart = session?.canStartEstimate === true
  const canWork = canStart || Boolean(draftVersion)
  const draftState = { branchId, stateId, estimateTitle, buildingName, customerName, customerEmail, customerPhone,
    equipmentTypeId, jobTypeId, market, requestInputs, selectedEquipment, selectedPackages }
  const currentSnapshot = JSON.stringify(draftState)
  const draftDirty = savedSnapshot ? savedSnapshot !== currentSnapshot : Boolean(branchId || buildingName || estimateTitle
    || customerName || customerEmail || customerPhone || equipmentTypeId || jobTypeId || Object.values(requestInputs).some(Boolean))
  const hasUnsavedChanges = Boolean(preferences.unsaved || preferences.busy || draftBusy || draftDirty)
  const selectedBranch = branches.find((branch) => branch.re_branchid === branchId)
  const marketBranches = branches.filter((branch) => branch.re_market === market)
  const marketName =
    (market === 126110000
      ? 'MKO'
      : market === 126110001
        ? 'CKE'
        : 'CKQ')

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = (event: MediaQueryListEvent) => setSystemDarkMode(event.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])

  useEffect(() => {
    document.documentElement.lang = language === 'fr' ? 'fr-CA' : 'en-US'
  }, [language])

  useEffect(() => {
    if (view === 'new') requestSection.current?.querySelector<HTMLElement>('[aria-current="step"]')?.focus()
  }, [step, view])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasUnsavedChanges])

  useEffect(() => {
    let cancelled = false
    void loadSession()
      .then((result) => { if (!cancelled) setSession(result) })
      .catch((error: unknown) => { if (!cancelled) setSessionError(message(error)) })
      .finally(() => { if (!cancelled) setSessionLoading(false) })
    return () => { cancelled = true }
  }, [sessionAttempt])

  const loadBranches = useCallback(async () => {
    setBranchLoading(true)
    setBranchError('')
    try {
      const records = await getBranches()
      setBranches(records)
    } catch (error) {
      setBranchError(message(error))
    } finally {
      setBranchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!session?.canReadEstimates) return
    const timeout = window.setTimeout(() => {
      void loadBranches()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadBranches, session?.canReadEstimates])

  useEffect(() => {
    if (!session?.canReadEstimates) return
    let cancelled = false
    void getRequestReferences()
      .then((result) => { if (!cancelled) setReferences(result) })
      .catch((error: unknown) => { if (!cancelled) setReferenceError(message(error)) })
    return () => { cancelled = true }
  }, [session?.canReadEstimates, referenceAttempt])

  useEffect(() => {
    if (!session?.canReadEstimates) return
    let cancelled = false
    void getDraftReferences().then((result) => {
      if (!cancelled) { setDraftReferences(result); setDraftReferenceError('') }
    }).catch((reason: unknown) => {
      if (!cancelled) setDraftReferenceError(message(reason))
    })
    return () => { cancelled = true }
  }, [session?.canReadEstimates, referenceAttempt])

  useEffect(() => {
    const query = equipmentQuery.trim()
    if (!branchId || query.length < 3) return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setEquipmentLoading(true)
      setEquipmentError('')
      void searchEquipment(branchId, query)
        .then((records) => {
          if (!cancelled) setEquipmentResults(records)
        })
        .catch((error: unknown) => {
          if (!cancelled) setEquipmentError(message(error))
        })
        .finally(() => {
          if (!cancelled) setEquipmentLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [branchId, equipmentQuery])

  useEffect(() => {
    const query = packageQuery.trim()
    const countryId = selectedBranch?._re_country_value
    if (!countryId || query.length < 2) return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setPackageLoading(true)
      setPackageError('')
      void searchStandardPackages(countryId, query)
        .then((records) => {
          if (!cancelled) setPackageResults(records)
        })
        .catch((error: unknown) => {
          if (!cancelled) setPackageError(message(error))
        })
        .finally(() => {
          if (!cancelled) setPackageLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [packageQuery, selectedBranch])

  const selectedPackageIds = useMemo(
    () => new Set(selectedPackages.map((repairPackage) => repairPackage.re_repairpackageid)),
    [selectedPackages],
  )

  function addMatchedEquipment(equipment: Equipment) {
    if (selectedEquipment.length >= 14) return
    if (selectedEquipment.some((item) => item.number === equipment.re_equipment)) {
      return
    }
    setSelectedEquipment((current) => [
      ...current,
      {
        id: equipment.re_equipmentid,
        number: equipment.re_equipment,
        name: equipment.re_equipmentname ?? '',
        location: equipment.re_functionallocation,
        customer: equipment.re_soldtoname ?? '',
        oem: equipment.re_oem ?? '',
        age: equipment.re_equipmentage,
        matched: true,
      },
    ])
    setEquipmentQuery('')
    setEquipmentResults([])
  }

  function addUnlistedEquipment() {
    const number = equipmentQuery.trim()
    if (!number || selectedEquipment.length >= 14) return
    if (selectedEquipment.some((item) => item.number === number)) return
    setSelectedEquipment((current) => [
      ...current,
      {
        id: `unlisted-${crypto.randomUUID()}`,
        number,
        name: '',
        location: '',
        customer: '',
        oem: '',
        matched: false,
      },
    ])
    setEquipmentQuery('')
    setEquipmentResults([])
  }

  function resetBranch(nextBranchId: string) {
    setBranchId(nextBranchId)
    setEquipmentQuery('')
    setEquipmentResults([])
    setSelectedEquipment([])
    setPackageQuery('')
    setPackageResults([])
    setSelectedPackages([])
    setEquipmentError('')
    setPackageError('')
    setEquipmentLoading(false)
    setPackageLoading(false)
  }

  function changeBranch(nextBranchId: string) {
    if (draftVersion) return
    if (nextBranchId === branchId) return
    if ((selectedEquipment.length > 0 || selectedPackages.length > 0) && !window.confirm(t.branchChangeWarning)) return
    resetBranch(nextBranchId)
    const branch = branches.find((row) => row.re_branchid === nextBranchId)
    setStateId(branch?._re_stateprovince_value ?? '')
    const province = draftReferences?.states.find((s) => s.id === branch?._re_stateprovince_value)
    setRequestInputs((current) => ({
      ...current,
      re_usetax: typeof branch?.re_defaultusetax !== 'number' ? '' : String(branch.re_defaultusetax * 100),
      re_freight: typeof branch?.re_defaultfreight !== 'number' ? '' : String(branch.re_defaultfreight * 100),
      re_timecategory: current.re_timecategory || '126110000',
      re_proposallanguage: province?.frenchRequired ? '126110001' : current.re_proposallanguage || (language === 'fr' ? '126110001' : '126110000'),
    }))
  }

  function changeMarket(nextMarket: Market) {
    if (!preferences.ready || preferences.busy) return
    if (market === nextMarket) return
    if (branchId && !window.confirm(t.marketChangeWarning)) return
    resetBranch('')
    setMarket(nextMarket)
    setStep(1)
    if (nextMarket === 126110002) {
      void preferences.save({ language: 'fr', locale: 'fr-CA', theme: preferences.theme })
    }
  }

  function changeEquipmentQuery(value: string) {
    setEquipmentQuery(value)
    setEquipmentResults([])
    setEquipmentError('')
  }

  function changePackageQuery(value: string) {
    setPackageQuery(value)
    setPackageResults([])
    setPackageError('')
  }

  function addPackage(repairPackage: RepairPackage) {
    if (selectedPackages.length >= 3 || selectedPackageIds.has(repairPackage.re_repairpackageid)) {
      return
    }
    setSelectedPackages((current) => [...current, repairPackage])
    setPackageQuery('')
    setPackageResults([])
  }

  function beginEstimate() {
    if (!canStart) return
    setStep(1)
    setView('new')
  }

  const dt = language === 'fr' ? {
    title: 'Nom du devis', province: 'Province / État du bâtiment', currency: 'Devise',
    save: 'Enregistrer le brouillon', saving: 'Enregistrement…', saved: 'Brouillon enregistré',
    open: 'Ouvrir le brouillon', working: 'Opération en cours…', new: 'Nouveau brouillon',
    warning: 'Des modifications ne sont pas enregistrées. Les abandonner ?',
    required: 'Renseignez le nom du devis, le client, le bâtiment, la province, les équipements, les forfaits, la langue, la catégorie de temps, la taxe et le fret.',
    note: 'Brouillon uniquement : prix enregistrés du serveur disponibles ; envoi pour approbation non connecté.',
    error: 'Opération impossible. Vérifiez que le service Dataverse re_DraftEstimate est déployé et que vos autorisations sont suffisantes. En cas de conflit ou de délai dépassé, rechargez le brouillon avant de réessayer.',
    reload: 'Recharger le brouillon', locked: 'La succursale et le marché sont fixes pour un brouillon enregistré.',
  } : {
    title: 'Estimate title', province: 'Building province / state', currency: 'Currency',
    save: 'Save draft', saving: 'Saving…', saved: 'Draft saved',
    open: 'Open draft', working: 'Operation in progress…', new: 'New draft',
    warning: 'There are unsaved changes. Discard them?',
    required: 'Complete estimate title, customer, building, province, equipment, packages, proposal language, time category, use tax and freight.',
    note: 'Draft only: saved server pricing is available; submission for approval is not connected.',
    error: 'Operation failed. Check that the Dataverse re_DraftEstimate service is deployed and you have permission. After a conflict or timeout, reload the draft before retrying.',
    reload: 'Reload draft', locked: 'Branch and market are fixed for a saved draft.',
  }
  const draftComplete = Boolean(estimateTitle.trim() && customerName.trim() && buildingName.trim() && stateId
    && branchId && equipmentTypeId && selectedEquipment.length && selectedPackages.length
    && requestInputs.re_proposallanguage && requestInputs.re_timecategory
    && requestInputs.re_usetax?.trim() && requestInputs.re_freight?.trim()
    && selectedBranch?._re_currency_value && draftReferences)

  function applyDraft(record: DraftRecord) {
    const inputs = draftInputs(record)
    const equipment = record.equipment.map((item) => ({
      ...item, id: item.matched ? item.id : `unlisted-${crypto.randomUUID()}`,
      name: item.name ?? '', location: item.location ?? '', customer: item.customer ?? '',
      oem: item.oem ?? '', age: item.age ?? undefined,
    }))
    const packages = record.packages.map((item) => ({
      re_repairpackageid: item.id, re_packagenumber: item.number, re_packagenameen: item.nameEn,
      re_packagenamefr: item.nameFr ?? undefined, re_proposalscopeen: item.scopeEn,
      re_proposalscopefr: item.scopeFr ?? undefined, re_mechanichours: item.hours,
    }))
    setDraftId(record.id); setDraftVersion(record.version); setDraftNumber(record.number ?? '')
    setSavedSalesperson(record.salesperson ?? '')
    setPricingUnavailable(record.pricingState === 'unavailable')
    setEstimateTitle(record.title); setBranchId(record.branchId); setStateId(record.stateId)
    setBuildingName(record.building); setCustomerName(record.customer)
    setCustomerEmail(record.email ?? ''); setCustomerPhone(record.phone ?? '')
    setEquipmentTypeId(record.equipmentTypeId); setJobTypeId(record.jobTypeId ?? '')
    setMarket(record.market); setRequestInputs(inputs); setSelectedEquipment(equipment); setSelectedPackages(packages)
    setEquipmentQuery(''); setEquipmentResults([]); setPackageQuery(''); setPackageResults([])
    setSavedSnapshot(JSON.stringify({
      branchId: record.branchId, stateId: record.stateId, estimateTitle: record.title,
      buildingName: record.building, customerName: record.customer, customerEmail: record.email ?? '',
      customerPhone: record.phone ?? '', equipmentTypeId: record.equipmentTypeId, jobTypeId: record.jobTypeId ?? '',
      market: record.market, requestInputs: inputs, selectedEquipment: equipment, selectedPackages: packages,
    }))
  }

  async function openDraft(id: string) {
    if (draftInFlight.current || (draftDirty && !window.confirm(dt.warning))) return
    draftInFlight.current = true
    setDraftBusy(true); setDraftError(''); setDraftNotice('')
    try {
      const record = await draftOperation({ mode: 'load', id })
      applyDraft(record); setStep(1); setView('new')
    } catch (reason) { setDraftError(`${dt.error} ${message(reason)}`) }
    finally { draftInFlight.current = false; setDraftBusy(false) }
  }

  async function saveDraft() {
    if (draftInFlight.current) return
    setDraftError(''); setDraftNotice('')
    if (!draftComplete) { setDraftError(dt.required); return }
    const controls = requestSection.current?.querySelectorAll<HTMLInputElement>('input')
    if (controls && !Array.from(controls).every((input) => input.reportValidity())) return
    draftInFlight.current = true; setDraftBusy(true)
    try {
      const record = await draftOperation({
        mode: 'save', id: draftId, version: draftVersion, title: estimateTitle,
        branchId, stateId, equipmentTypeId, jobTypeId, building: buildingName,
        customer: customerName, email: customerEmail, phone: customerPhone, market,
        fields: Object.entries(requestInputs).map(([key, value]) => ({ key, value: value ?? '' })),
        equipment: selectedEquipment.map((item) => ({ ...item, id: item.matched ? item.id : '' })),
        packages: selectedPackages.map((item) => ({ id: item.re_repairpackageid,
          number: item.re_packagenumber, nameEn: item.re_packagenameen, scopeEn: item.re_proposalscopeen ?? '',
          hours: 0, material: 0 })),
      })
      applyDraft(record); setDraftNotice(`${dt.saved}: ${record.number || record.id}`)
    } catch (reason) { setDraftError(`${dt.error} ${message(reason)}`) }
    finally { draftInFlight.current = false; setDraftBusy(false) }
  }

  function newDraft() {
    if (draftBusy || (draftDirty && !window.confirm(dt.warning))) return
    setDraftId(crypto.randomUUID()); setDraftVersion(null); setDraftNumber(''); setSavedSnapshot('')
    setSavedSalesperson('')
    setPricingUnavailable(false)
    setEstimateTitle(''); resetBranch(''); setStateId(''); setEquipmentTypeId(''); setJobTypeId('')
    setBuildingName(''); setCustomerName(''); setCustomerEmail(''); setCustomerPhone('')
    setRequestInputs({}); setDraftError(''); setDraftNotice(''); setStep(1); setView('new')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#home"
          onClick={(event) => {
            event.preventDefault()
            setView('estimates')
          }}
        >
          <svg width="0" height="0" aria-hidden="true" focusable="false" className="logo-filter-definition">
            <defs>
              <filter id="kone-logo-transparency" colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.085 0 0 0 -0.085" />
              </filter>
            </defs>
          </svg>
          <img className="brand-logo" src={koneLogo} alt="KONE" />
          <span className="brand-copy">
            <strong>{t.appName}</strong>
            <small>KTOC PSR</small>
          </span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          <button
            className={`nav-item ${view === 'estimates' ? 'active' : ''}`}
            onClick={() => setView('estimates')}
          >
            <NavigationIcon name="dashboard" />
            {t.estimates}
          </button>
          <button
            className={`nav-item ${view === 'new' ? 'active' : ''}`}
            onClick={beginEstimate}
            disabled={!canStart}
          >
            <NavigationIcon name="new" />
            {t.newEstimate}
          </button>
          <button
            className={`nav-item ${view === 'requests' ? 'active' : ''}`}
            onClick={() => setView('requests')}
            disabled={!session?.canReadEstimates}
          >
            <NavigationIcon name="requests" />
            {t.repairRequests}
          </button>
          {[
            [t.estimatorNav, 'estimator'],
            [t.pricingNav, 'pricing'],
            [t.quotesNav, 'quotes'],
            ...(session?.role === 'admin' ? [
              [t.approvalsNav, 'approvals'],
              [t.masterDataNav, 'data'],
              [t.reportsNav, 'reports'],
              [t.settingsNav, 'settings'],
            ] : []),
          ].map(([label, icon]) => (
            <button
              className="nav-item future"
              disabled
              key={label}
              title={t.comingSoon}
            >
              <NavigationIcon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-status" aria-hidden="true" />
          <span className="user-detail">
            <strong>{session?.displayName || t.user}</strong>
            <small>{roleLabel}</small>
          </span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <form className="header-request-search" role="search" aria-label={t.requestSearch}
            onSubmit={(event) => {
              event.preventDefault()
              if (!session?.canReadEstimates || draftBusy) return
              if (view === 'new' && draftDirty && !window.confirm(dt.warning)) return
              setRequestSearch(searchInput.trim()); setView('requests')
            }}>
            <label className="sr-only" htmlFor="header-request-search">{t.requestSearch}</label>
            <span className="search-icon" aria-hidden="true" />
            <input id="header-request-search" type="search" maxLength={150} value={searchInput}
              placeholder={t.requestSearch} disabled={!session?.canReadEstimates || draftBusy}
              onChange={(event) => setSearchInput(event.target.value)} />
            <button type="submit" className="button secondary" disabled={!session?.canReadEstimates || draftBusy}>
              {t.searchAction}
            </button>
          </form>
          <div className="topbar-actions">
            <label className="market-control">
              <span className="sr-only">{t.market}</span>
              <select aria-label={t.market} value={market} disabled={!preferences.ready || preferences.busy || draftBusy || Boolean(draftVersion)} onChange={(event) => {
                const value = Number(event.target.value)
                if (value === 126110000 || value === 126110001 || value === 126110002) changeMarket(value)
              }}>
                <option value={126110000}>MKO</option>
                <option value={126110001}>CKE</option>
                <option value={126110002}>CKQ</option>
              </select>
            </label>
            <span className="role-label">{roleLabel}</span>
            <label className="language-control">
              <span className="sr-only">{t.theme}</span>
              <select aria-label={t.theme} value={preferences.theme} disabled={!preferences.ready || preferences.busy}
                onChange={(event) => {
                  const theme = event.target.value
                  if (theme === 'system' || theme === 'dark' || theme === 'light') void preferences.save({ language, locale: preferences.locale, theme })
                }}>
                <option value="system">{t.systemTheme}</option>
                <option value="light">{t.lightMode}</option>
                <option value="dark">{t.darkMode}</option>
              </select>
            </label>
            <label className="language-control">
              <span className="sr-only">{t.language}</span>
              <select
                value={language}
                disabled={!preferences.ready || preferences.busy}
                onChange={(event) => {
                  const next = event.target.value
                  if (next === 'en' || next === 'fr') void preferences.save({
                    language: next, locale: next === 'fr' ? 'fr-CA' : 'en-US', theme: preferences.theme,
                  })
                }}
                aria-label={t.language}
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
              </select>
            </label>
            {session && <UserAvatar name={session.displayName} language={language} />}
          </div>
        </header>

        <div className="content-wrap">
          {session && (preferences.error ? (
            <div className="error-box" role="alert">
              <strong>{t.preferencesError}</strong>
              <span>{preferences.error}</span>
              {preferences.unsaved && <span>{t.preferencesUnsaved}</span>}
              <button className="button secondary" disabled={preferences.busy} onClick={preferences.retry}>{t.retry}</button>
            </div>
          ) : !preferences.ready || preferences.busy ? (
            <p className="inline-state" role="status">{preferences.busy ? t.preferencesSaving : t.preferencesLoading}</p>
          ) : null)}
          {session?.developmentAdminOverride && (
            <p className="draft-notice" role="status">{t.developmentAdminNotice}</p>
          )}
          {draftBusy && <p className="inline-state" role="status">{dt.working}</p>}
          {draftError && <div className="error-box draft-error" role="alert">
            <span>{draftError}</span>
            <button className="button secondary" disabled={draftBusy} onClick={() => void openDraft(draftId)}>{dt.reload}</button>
          </div>}
          {draftNotice && <p className="inline-state draft-saved" role="status">{draftNotice}</p>}
          {pricingUnavailable && <p className="draft-notice" role="status">
            {language === 'fr'
              ? 'Le brouillon est enregistré, mais le calcul des prix est indisponible. Vérifiez les données et la configuration avec votre administrateur avant toute soumission.'
              : 'The draft is saved, but pricing is unavailable. Ask your administrator to check the inputs and configuration before submission.'}
          </p>}
          {sessionLoading ? (
            <p className="inline-state" role="status">{t.checkingAccess}</p>
          ) : sessionError ? (
            <div className="error-box" role="alert">
              <strong>{t.accessError}</strong>
              <span>{sessionError}</span>
              <button className="button secondary" onClick={() => {
                setSession(undefined)
                setSessionError('')
                setSessionLoading(true)
                setSessionAttempt((current) => current + 1)
              }}>{t.retry}</button>
            </div>
          ) : !session?.role || !session.canReadEstimates ? (
            <div className="error-box" role="alert">
              <strong>{!session?.role ? t.noRole : t.noRead}</strong>
            </div>
          ) : !canStart ? <p className="inline-state">{t.noCreate}</p> : null}
          {view === 'requests' ? (
            session?.canReadEstimates ?
            <section className="page-content">
              <div className="page-heading"><div>
                <h1>{t.repairRequests}</h1>
                <p>{t.recentRequestsHint}</p>
              </div></div>
              <section className="dashboard-card"><EstimateList key={market} market={market} search={requestSearch} language={language} onOpen={(id) => void openDraft(id)} busy={draftBusy} /></section>
            </section>
            : null
          ) : view === 'new' && !canWork ? null : (
          <>
          {view === 'estimates' ? (
            <section className="page-content operations-dashboard">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">{language === 'fr' ? 'VUE D’ENSEMBLE' : 'OVERVIEW'}</div>
                  <h1>{marketName} · {t.dashboardTitle}</h1>
                  <p>{t.dashboardSubtitle}</p>
                </div>
                <button className="button primary" onClick={beginEstimate} disabled={!canStart}>
                  <span aria-hidden="true">+</span>
                  {t.startEstimate}
                </button>
              </div>
              {session?.canReadEstimates && <DashboardMetrics market={market} owner={session.userId} language={language} />}
              <section className="dashboard-card recent-card">
                <div className="dashboard-card-heading">
                  <div>
                    <h2>{t.recentRequests}</h2>
                    <p>{t.recentRequestsHint}</p>
                  </div>
                  <button className="button tertiary" onClick={() => setView('requests')}>
                    {t.viewRequests} <span aria-hidden="true">→</span>
                  </button>
                </div>
                {session?.canReadEstimates && <EstimateList recent key={market} market={market} language={language} onOpen={(id) => void openDraft(id)} busy={draftBusy} />}
              </section>
            </section>
          ) : (
            <section className="page-content" ref={requestSection}>
              <div className="page-heading new-heading">
                <div>
                  <div className="eyebrow">CREATE · REQUEST WORKSPACE</div>
                  <h1>{t.newTitle}</h1>
                  <p>{t.newSubtitle}</p>
                </div>
                <span className="unsaved-badge">{draftVersion && !draftDirty ? `${dt.saved} ${draftNumber}` : t.notSaved}</span>
              </div>
              <div className="draft-toolbar">
                <button className="button secondary" onClick={newDraft} disabled={draftBusy || !canStart}>{dt.new}</button>
                {draftVersion && <button className="button secondary" disabled={draftBusy}
                  onClick={() => void openDraft(draftId)}>{dt.reload}</button>}
                <button className="button primary" disabled={draftBusy || !canWork || !draftComplete}
                  onClick={() => void saveDraft()}>{draftBusy ? dt.saving : dt.save}</button>
              </div>
              {draftVersion && <p className="field-help">{dt.locked}</p>}
              <fieldset className="draft-workspace" disabled={draftBusy}>

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
                        </div>
                        <div className="field-label">
                          <label htmlFor="draft-currency">{dt.currency}</label>
                          <input id="draft-currency" className="text-input" readOnly
                            value={draftReferences?.currencies.find((c) => c.id === selectedBranch?._re_currency_value)?.code ?? '—'} />
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
                        <div className="field-label">
                          <label htmlFor="opportunity-building">{t.buildingName}<span className="required">*</span></label>
                          <input id="opportunity-building" className="text-input" aria-required="true" value={buildingName}
                            maxLength={300} onChange={(event) => setBuildingName(event.target.value)} />
                        </div>
                      </div>
                      <div className="field-label">
                        <label htmlFor="draft-province">{dt.province}<span className="required">*</span></label>
                        <select id="draft-province" className="text-input" value={stateId} aria-required="true"
                          disabled={!branchId || !draftReferences} onChange={(event) => {
                            setStateId(event.target.value)
                            if (draftReferences?.states.find((s) => s.id === event.target.value)?.frenchRequired)
                              updateRequestInput('re_proposallanguage', '126110001')
                          }}>
                          <option value="">{t.chooseReference}</option>
                          {draftReferences?.states.filter((s) => s.countryId === selectedBranch?._re_country_value).map((s) => (
                            <option key={s.id} value={s.id}>{language === 'fr' ? s.fr || s.en : s.en}</option>
                          ))}
                        </select>
                      </div>
                      </fieldset>
                      <fieldset className="opportunity-group">
                      <legend>{t.requestDetails}</legend>
                      <RequestFields stage="request" language={language} value={requestInputs} onChange={updateRequestInput} />
                      </fieldset>
                      </>}
                      {step === 2 && <>
                      <label className="field-label search-label" htmlFor="equipment-search">{t.equipment}<span className="required">*</span></label>
                      <div className="search-control">
                        <span className="search-icon" aria-hidden="true" />
                        <input
                          id="equipment-search"
                          className="text-input search-input"
                          value={equipmentQuery}
                          onChange={(event) => changeEquipmentQuery(event.target.value)}
                          placeholder={t.equipmentSearch}
                          disabled={!branchId}
                          autoComplete="off"
                        />
                        {equipmentLoading && <span className="spinner" aria-label={t.searching} />}
                      </div>
                      <p className="field-help">
                        {branchId ? t.searchHelp : t.branchRequired}
                      </p>

                      {equipmentError && (
                        <div className="error-box compact" role="alert">
                          <strong>{t.dataError}</strong>
                          <span>{equipmentError}</span>
                        </div>
                      )}

                      {equipmentResults.length > 0 && (
                        <div className="result-list" role="listbox" aria-label={t.equipment}>
                          {equipmentResults.map((equipment) => (
                            <div className="result-row" key={equipment.re_equipmentid}>
                              <div className="result-main">
                                <strong>{equipment.re_equipment}</strong>
                                <span>{equipment.re_equipmentname}</span>
                                <small>{equipment.re_functionallocation || t.location}: {equipment.re_soldtoname || t.customer}</small>
                              </div>
                              <button
                                className="button small secondary"
                                onClick={() => addMatchedEquipment(equipment)}
                                disabled={selectedEquipment.length >= 14}
                              >
                                {t.selectEquipment}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {!equipmentLoading && equipmentQuery.trim().length >= 3 && !equipmentError && (
                        <div className="no-results">
                          {equipmentResults.length === 0 && <p>{t.noEquipment}</p>}
                          {!selectedEquipment.some((item) => item.number === equipmentQuery.trim()) && (
                            <button className="text-button" onClick={addUnlistedEquipment}>
                              {t.unlisted}: <strong>{equipmentQuery.trim()}</strong>
                            </button>
                          )}
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
                                onClick={() => setSelectedEquipment((current) => current.filter((item) => item.id !== equipment.id))}
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
                        <strong>{selectedEquipment.length}<small> / 14</small></strong>
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
                      <div className="search-control">
                        <span className="search-icon" aria-hidden="true" />
                        <input
                          id="package-search"
                          className="text-input search-input"
                          value={packageQuery}
                          onChange={(event) => changePackageQuery(event.target.value)}
                          placeholder={t.packageSearch}
                          disabled={!selectedBranch?._re_country_value || selectedPackages.length >= 3}
                          autoComplete="off"
                        />
                        {packageLoading && <span className="spinner" aria-label={t.searchingPackages} />}
                      </div>
                      <p className="field-help">{t.packageSearchHelp}</p>
                      {!selectedBranch?._re_country_value && <p className="error-box" role="alert">{t.missingCountry}</p>}
                      {packageError && (
                        <div className="error-box compact" role="alert">
                          <strong>{t.dataError}</strong>
                          <span>{packageError}</span>
                        </div>
                      )}
                      {packageResults.length > 0 && (
                        <div className="result-list">
                          {packageResults.map((repairPackage) => (
                            <div className="result-row" key={repairPackage.re_repairpackageid}>
                              <div className="result-main">
                                <strong>{repairPackage.re_packagenumber}</strong>
                                <span>{localizePackage(repairPackage, language)}</span>
                                {repairPackage.re_proposalscopeen && <small>{repairPackage.re_proposalscopeen}</small>}
                              </div>
                              <button
                                className="button small secondary"
                                onClick={() => addPackage(repairPackage)}
                                disabled={selectedPackages.length >= 3 || selectedPackageIds.has(repairPackage.re_repairpackageid)}
                              >
                                {t.addPackage}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {!packageLoading &&
                        packageQuery.trim().length >= 2 &&
                        packageResults.length === 0 &&
                        !packageError && <div className="no-results"><p>{t.noPackages}</p></div>}
                    </section>
                    {selectedPackages.length > 0 && (
                      <section className="form-card selected-card">
                        <div className="section-heading">
                          <span className="section-icon check-icon">✓</span>
                          <div>
                            <h2>{t.selectedPackages}</h2>
                            <p>{selectedPackages.length} / 3</p>
                          </div>
                        </div>
                        <div className="selected-list">
                          {selectedPackages.map((repairPackage) => (
                            <article className="equipment-card" key={repairPackage.re_repairpackageid}>
                              <div className="equipment-index">PK</div>
                              <div className="equipment-info">
                                <div className="equipment-title">
                                  <strong>{repairPackage.re_packagenumber}</strong>
                                </div>
                                <span>{localizePackage(repairPackage, language)}</span>
                              </div>
                              <button
                                className="icon-button remove-button"
                                aria-label={`${t.remove} ${repairPackage.re_packagenumber}`}
                                onClick={() => setSelectedPackages((current) => current.filter((item) => item.re_repairpackageid !== repairPackage.re_repairpackageid))}
                              >
                                ×
                              </button>
                            </article>
                          ))}
                        </div>
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
                        <strong>{selectedPackages.length}<small> / 3</small></strong>
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
                    <section className="form-card">
                      <div className="section-heading">
                        <span className="section-icon">{step === 3 ? '03' : '04'}</span>
                        <div>
                          <h2>{step === 3 ? t.costsTitle : t.proposalPrice}</h2>
                          <p>{step === 3 ? t.costsHint : t.pricingHint}</p>
                        </div>
                      </div>
                      <RequestFields stage={step === 3 ? 'cost' : 'pricing'} language={language}
                        value={requestInputs} onChange={updateRequestInput} />
                      <p className="draft-notice">{step === 3 ? t.costsUnavailable : t.pricingHint}</p>
                    </section>
                    {step === 4 && <PricingSummary id={draftId} version={draftVersion} dirty={draftDirty}
                      language={language} currencies={draftReferences?.currencies ?? []} />}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="form-layout">
                  <div className="form-main">
                    <PricingSummary id={draftId} version={draftVersion} dirty={draftDirty}
                      language={language} currencies={draftReferences?.currencies ?? []} />
                    <section className="form-card">
                      <div className="section-heading">
                        <span className="section-icon">05</span>
                        <div>
                          <h2>{t.reviewTitle}</h2>
                          <p>{t.customerHint}</p>
                        </div>
                        </div>
                      <div className="input-grid">
                        <label className="field-label" htmlFor="customer-name">
                          {t.customerName}
                          <input id="customer-name" className="text-input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                        </label>
                        <label className="field-label" htmlFor="building-name">
                          {t.buildingName}
                          <input id="building-name" className="text-input" value={buildingName} onChange={(event) => setBuildingName(event.target.value)} />
                        </label>
                        <label className="field-label" htmlFor="customer-email">
                          {t.customerEmail}
                          <input id="customer-email" type="email" className="text-input" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
                        </label>
                        <label className="field-label" htmlFor="customer-phone">
                          {t.customerPhone}
                          <input id="customer-phone" type="tel" className="text-input" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
                        </label>
                      </div>
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
                        {selectedPackages.map((repairPackage) => <li key={repairPackage.re_repairpackageid}>
                          {repairPackage.re_packagenumber} — {localizePackage(repairPackage, language)}
                        </li>)}
                      </ul>
                      {(['request', 'cost', 'pricing'] as const).map((stage) => (
                        <details key={stage}>
                          <summary>{stage === 'request' ? t.requestDetails : stage === 'cost' ? t.stepCosts : t.stepPricing}</summary>
                          <RequestFields stage={stage} language={language} value={requestInputs} onChange={updateRequestInput} readOnly />
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
                <button className="button tertiary" onClick={() => (step === 1 ? setView('estimates') : setStep((current) => current - 1))}>
                  {t.back}
                </button>
                <div className="footer-actions">
                  {step < 5 ? (
                    <button
                      className="button primary"
                      onClick={() => {
                        const inputs = requestSection.current?.querySelectorAll<HTMLInputElement>('input')
                        if (inputs && !Array.from(inputs).every((input) => input.reportValidity())) return
                        setStep((current) => current + 1)
                      }}
                      disabled={step === 1 ? !branchId || !buildingName.trim() || !equipmentTypeId : step === 2 ? selectedEquipment.length === 0 || selectedPackages.length === 0 : false}
                    >
                      {step === 1 ? t.nextEquipment : t.continue}
                      <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="button primary" disabled={draftBusy || !draftComplete}
                      onClick={() => void saveDraft()} title={draftComplete ? dt.note : dt.required}>
                      {draftBusy ? dt.saving : dt.save}
                    </button>
                  )}
                </div>
              </div>
              </fieldset>
            </section>
          )}
          </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
