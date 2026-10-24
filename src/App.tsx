import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getBranches,
  getRequestReferences,
  searchEquipment,
  searchStandardPackages,
  type Branch,
  type Equipment,
  type RepairPackage,
  type ReferenceOption,
} from './data/repairEstimatorRepository'
import './App.css'
import { EstimateList } from './EstimateList'
import { loadSession, type AppSession } from './data/sessionRepository'
import { RequestFields, type RequestInputs } from './RequestFields'
import type { Market } from './data/estimateQuery'
import { useUserPreferences } from './useUserPreferences'
import { BranchSelect } from './BranchSelect'

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
    opportunityHint: 'Estimator header inputs for the selected market. Supervisor is optional; customer contact details are confirmed at review.',
    nextEquipment: 'Continue to equipment & packages',
    costsHint: 'Inputs only. No costs, margins or incentives are calculated or saved in this browser.',
    pricingHint: 'Server calculation is not connected. Suggested price and actual CMII are unavailable; entered sell price is not an approved quote.',
    equipmentNote: 'Equipment names are resolved from Dataverse. Unlisted numbers remain explicitly unbound.',
    costsTitle: 'Standard package cost inputs',
    costsUnavailable: 'Package labor, material, tax and freight totals require verified server calculation. Enter percentages as displayed in Excel (e.g. 5 for 5%); defaults are not loaded. Custom/T&M line entry is not implemented yet.',
    proposalPrice: 'Proposal pricing',
    partnerTitle: 'Partner information & CTT notes',
    selectedCount: 'Equipment quantity (from selected units)',
    workbookAlignment: 'Workbook-aligned input capture only. Saving, custom/T&M costing, calculation, and submission are not connected.',
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
      'Choose up to three packages. Hours and materials scale with the equipment count. Pricing will be shown after server calculation is connected.',
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
    opportunityHint: 'En-tête de l’estimateur pour le marché sélectionné. Le superviseur est facultatif ; les coordonnées du client sont confirmées à la vérification.',
    nextEquipment: 'Continuer vers les équipements et forfaits',
    costsHint: 'Saisie uniquement. Aucun coût, marge ou incitatif n’est calculé ou enregistré dans le navigateur.',
    pricingHint: 'Le calcul serveur n’est pas connecté. Le prix suggéré et le CMII réel sont indisponibles ; le prix saisi n’est pas un devis approuvé.',
    equipmentNote: 'Les noms des équipements proviennent de Dataverse. Les numéros non répertoriés restent sans correspondance.',
    costsTitle: 'Coûts supplémentaires du forfait standard',
    costsUnavailable: 'Les totaux de main-d’œuvre, matériaux, taxes et fret nécessitent le calcul serveur vérifié. Saisissez les pourcentages comme dans Excel (ex. 5 pour 5 %) ; les valeurs par défaut ne sont pas chargées. La saisie personnalisée/T&M n’est pas encore implémentée.',
    proposalPrice: 'Prix de la proposition',
    partnerTitle: 'Partenaires et notes CTT',
    selectedCount: 'Quantité d’équipements (unités sélectionnées)',
    workbookAlignment: 'Saisie alignée sur le classeur uniquement. Enregistrement, coûts personnalisés/T&M, calcul et envoi non connectés.',
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
      'Choisissez jusqu’à trois forfaits. Les heures et matériaux varient selon le nombre d’équipements. Le prix sera affiché après la connexion du calcul serveur.',
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
  repairPackage: RepairPackage,
  language: Language,
): string {
  if (language === 'fr' && repairPackage.re_packagenamefr) {
    return repairPackage.re_packagenamefr
  }
  return repairPackage.re_packagenameen
}

function App() {
  const [market, setMarket] = useState<Market>(126110000)
  const [systemDarkMode, setSystemDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [view, setView] = useState<View>('estimates')
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
  const [selectedPackages, setSelectedPackages] = useState<RepairPackage[]>([])
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
  const requestSection = useRef<HTMLElement>(null)
  function updateRequestInput(key: keyof RequestInputs, value: string) {
    setRequestInputs((current) => ({ ...current, [key]: value }))
  }

  const t = copy[language]
  const roleLabel = session?.role === 'admin' ? t.adminRole
    : session?.role === 'estimator' ? t.estimatorRole : t.unverifiedRole
  const canStart = session?.canStartEstimate === true
  const hasUnsavedChanges = Boolean(preferences.unsaved || preferences.busy || branchId || buildingName || customerName || customerEmail || customerPhone
    || equipmentTypeId || jobTypeId || Object.values(requestInputs).some(Boolean))
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
    if (!canStart) return
    const timeout = window.setTimeout(() => {
      void loadBranches()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadBranches, canStart])

  useEffect(() => {
    if (!canStart) return
    let cancelled = false
    void getRequestReferences()
      .then((result) => { if (!cancelled) setReferences(result) })
      .catch((error: unknown) => { if (!cancelled) setReferenceError(message(error)) })
    return () => { cancelled = true }
  }, [canStart, referenceAttempt])

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
    if (nextBranchId === branchId) return
    if ((selectedEquipment.length > 0 || selectedPackages.length > 0) && !window.confirm(t.branchChangeWarning)) return
    resetBranch(nextBranchId)
  }

  function changeMarket(nextMarket: Market) {
    if (market === nextMarket) return
    if (branchId && !window.confirm(t.marketChangeWarning)) return
    resetBranch('')
    setMarket(nextMarket)
    setStep(1)
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
          <img className="brand-logo" src="/kone-logo.jpg" alt="KONE" />
          <span className="brand-copy">
            <strong>{t.workspace}</strong>
            <small>{t.appName}</small>
          </span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          <button
            className={`nav-item ${view === 'estimates' ? 'active' : ''}`}
            onClick={() => setView('estimates')}
          >
            <span className="nav-icon" aria-hidden="true">▦</span>
            {t.estimates}
          </button>
          <button
            className={`nav-item ${view === 'new' ? 'active' : ''}`}
            onClick={beginEstimate}
            disabled={!canStart}
          >
            <span className="nav-icon plus" aria-hidden="true">+</span>
            {t.newEstimate}
          </button>
          <button
            className={`nav-item ${view === 'requests' ? 'active' : ''}`}
            onClick={() => setView('requests')}
            disabled={!session?.canReadEstimates}
          >
            <span className="nav-icon" aria-hidden="true">▤</span>
            {t.repairRequests}
          </button>
          {[
            [t.estimatorNav, '▦'],
            [t.pricingNav, '$'],
            [t.quotesNav, '▧'],
            ...(session?.role === 'admin' ? [
              [t.approvalsNav, '✓'],
              [t.masterDataNav, '▥'],
              [t.reportsNav, '▨'],
              [t.settingsNav, '⚙'],
            ] : []),
          ].map(([label, icon]) => (
            <button
              className="nav-item future"
              disabled
              key={label}
              title={t.comingSoon}
            >
              <span className="nav-icon" aria-hidden="true">{icon}</span>
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
          <div className="breadcrumb">
            <span>{t.appName}</span>
            <span aria-hidden="true">/</span>
            <strong>{view === 'new' ? t.newEstimate : view === 'requests' ? t.repairRequests : t.estimates}</strong>
          </div>
          <div className="topbar-actions">
            <label className="market-control">
              <span className="sr-only">{t.market}</span>
              <select aria-label={t.market} value={market} onChange={(event) => {
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
            <span className="user-avatar small-avatar" aria-hidden="true">K</span>
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
              <section className="dashboard-card"><EstimateList key={market} market={market} language={language} /></section>
            </section>
            : null
          ) : view === 'new' && !canStart ? null : (
          <>
          {view === 'estimates' ? (
            <section className="page-content">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">OVERVIEW</div>
                  <h1>{t.dashboardTitle}</h1>
                  <p>{t.dashboardSubtitle}</p>
                </div>
                <button className="button primary" onClick={beginEstimate} disabled={!canStart}>
                  <span aria-hidden="true">+</span>
                  {t.startEstimate}
                </button>
              </div>
              <div className="dashboard-stats" aria-label={t.dashboardTitle}>
                {[
                  [t.openRequests, '↗'],
                  [t.pendingApprovals, '⌛'],
                  [t.quotesSent, '➤'],
                  [t.averageMargin, '%'],
                ].map(([label, icon], index) => (
                  <article className="dashboard-stat" key={label}>
                    <div className="dashboard-stat-copy">
                      <span>{label}</span>
                      <strong>—</strong>
                      <small>{t.metricsPending}</small>
                    </div>
                    <span className={`dashboard-stat-icon tone-${index}`} aria-hidden="true">{icon}</span>
                  </article>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="dashboard-card">
                  <div className="dashboard-card-heading">
                    <div>
                      <h2>{t.requestStatus}</h2>
                      <p>{t.requestStatusHint}</p>
                    </div>
                    <span className="market-badge">{marketName || 'KONE'}</span>
                  </div>
                  <div className="dashboard-empty">
                    <span className="dashboard-empty-mark" aria-hidden="true">◷</span>
                    <p>{t.metricsPending}</p>
                  </div>
                </section>
                <section className="dashboard-card">
                  <div className="dashboard-card-heading">
                    <div>
                      <h2>{t.repairTypes}</h2>
                      <p>{t.repairTypesHint}</p>
                    </div>
                  </div>
                  <div className="dashboard-empty">
                    <span className="dashboard-empty-mark" aria-hidden="true">▤</span>
                    <p>{t.metricsPending}</p>
                  </div>
                </section>
              </div>
              <section className="dashboard-card recent-card">
                <div className="dashboard-card-heading">
                  <div>
                    <h2>{t.recentRequests}</h2>
                    <p>{t.recentRequestsHint}</p>
                  </div>
                  <button className="button primary" onClick={beginEstimate} disabled={!canStart}>
                    <span aria-hidden="true">+</span>
                    {t.startEstimate}
                  </button>
                </div>
                {session?.canReadEstimates && <EstimateList key={market} market={market} language={language} />}
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
                <span className="unsaved-badge">{t.notSaved}</span>
              </div>

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
                    <section className="form-card">
                      <div className="section-heading">
                        <span className="section-icon">{step === 1 ? '01' : '02'}</span>
                        <div>
                          <h2>{step === 1 ? t.stepOpportunity : t.equipment}</h2>
                          <p>{step === 1 ? t.opportunityHint : t.equipmentHint}</p>
                        </div>
                      </div>
                      {step === 1 && <>
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
                          <BranchSelect key={market} branches={marketBranches} value={branchId}
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
                              { id: 'equipment-type', label: `${t.equipmentType} *`, value: equipmentTypeId, update: setEquipmentTypeId, options: references.equipmentTypes },
                              { id: 'job-type', label: t.jobType, value: jobTypeId, update: setJobTypeId, options: references.jobTypes },
                            ].map((field) => (
                              <div className="field-label" key={field.id}>
                                <label htmlFor={field.id}>{field.label}</label>
                                <select id={field.id} className="text-input" value={field.value} onChange={(event) => field.update(event.target.value)}>
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
                          <input id="salesperson" className="text-input" value={session?.displayName ?? ''} readOnly />
                        </div>
                        <div className="field-label">
                          <label htmlFor="opportunity-building">{t.buildingName}<span className="required">*</span></label>
                          <input id="opportunity-building" className="text-input" value={buildingName}
                            maxLength={300} onChange={(event) => setBuildingName(event.target.value)} />
                        </div>
                      </div>
                      <h3>{t.requestDetails}</h3>
                      <RequestFields stage="request" language={language} value={requestInputs} onChange={updateRequestInput} />
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
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="form-layout">
                  <div className="form-main">
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
                      <p className="draft-notice">{t.draftUnavailable}</p>
                    </section>
                  </div>
                  <aside className="form-aside">
                    <div className="aside-card">
                      <span className="aside-overline">{t.readyNext}</span>
                      <h3>{t.notSaved}</h3>
                      <p>{t.readyNextText}</p>
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
                    <button className="button primary" disabled title={t.draftUnavailable}>
                      {t.notSaved}
                    </button>
                  )}
                </div>
              </div>
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
