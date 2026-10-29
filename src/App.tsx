import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getBranches,
  getRequestReferences,
  getDraftReferences,
  type DraftReferences,
  searchEquipment,
  findEquipmentByNumbers,
  listPackages,
  type Branch,
  type Equipment,
  type RepairPackage,
  type ReferenceOption,
} from './data/repairEstimatorRepository'
import './App.css'
import { EstimateList } from './EstimateList'
import { LazyWorkspace } from './LazyWorkspace'
import { DashboardMetrics } from './DashboardMetrics'
import { Settings } from './Settings'
import { loadSession, type AppSession } from './data/sessionRepository'
import type { RequestInputs } from './RequestFields'
import { pricingUnavailableMessage, statedRateError, submissionErrorMessage } from './data/requestValidation'
import type { Market } from './data/estimateQuery'
import { useUserPreferences } from './useUserPreferences'
import { UserAvatar } from './UserAvatar'
import koneLogo from './assets/kone-logo-small.jpg?no-inline'
import { draftOperation, draftInputs, type DraftRecord } from './data/draftRepository'
import { serializeDraft, MAX_DRAFT_CHILD_OPERATIONS, type DraftLabor, type DraftMaterial } from './data/draftContract'
import { MAX_EQUIPMENT, MAX_PASTED_EQUIPMENT, parseEquipmentList, planEquipmentAdd } from './data/equipmentPaste'

const loadEstimator = () => import('./EstimatorWorkspace')
const loadMaster = () => import('./MasterDataWorkspace').then((module) => ({ default: module.MasterDataWorkspace }))

type Language = 'en' | 'fr'
type View = 'estimates' | 'requests' | 'new' | 'settings' | 'master' | 'packages'
export type SelectedEquipment = {
  id: string
  number: string
  name: string
  location: string
  customer: string
  oem: string
  age?: number
  matched: boolean
}

export type EquipmentPasteResult = {
  added: string[]
  notFound: string[]
  alreadySelected: string[]
  overLimit: string[]
  truncated: boolean
}

function toSelectedEquipment(equipment: Equipment): SelectedEquipment {
  return {
    id: equipment.re_equipmentid,
    number: equipment.re_equipment,
    name: equipment.re_equipmentname ?? '',
    location: equipment.re_functionallocation,
    customer: equipment.re_soldtoname ?? '',
    oem: equipment.re_oem ?? '',
    age: equipment.re_equipmentage,
    matched: true,
  }
}

const copy = {
  en: {
    appName: 'Repair Estimator',
    workspace: 'KTOC PSR ESTIMATOR',
    estimates: 'Dashboard',
    newEstimate: 'New Request',
    repairRequests: 'Repair Requests',
    packagesNav: 'Package Details',
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
    pricingHint: 'Use Calculate below to save your draft and calculate pricing in Dataverse. After changing inputs, use Recalculate. An entered selling price is not an approved quote.',
    equipmentNote: 'Equipment names are resolved from Dataverse. Unlisted numbers remain explicitly unbound.',
    costsTitle: 'Estimate costs and additions',
    costsUnavailable: 'Save to calculate server totals. Enter 5 for 5%. Package costs scale with equipment; custom lines and additional costs are added once. Do not enter the same work in both.',
    proposalPrice: 'Proposal pricing',
    partnerTitle: 'Partner information & CTT notes',
    selectedCount: 'Equipment quantity (from selected units)',
    workbookAlignment: 'Pricing is calculated in Dataverse. Mixed/custom costs follow the confirmed business rules; Excel reconciliation is still required. Submission is not connected.',
    branchChangeWarning: 'Changing branch removes the selected equipment and packages. Continue?',
    missingCountry: 'This branch has no country lookup. Package search cannot run; ask an administrator to correct the branch data.',
    provinceFromBranch: 'Set automatically from the selected branch.',
    missingProvince: 'This branch has no province/state. Ask an administrator to correct the branch data.',
    stepEquipment: 'Equipment',
    stepPackages: 'Packages',
    stepReview: 'Review',
    stepOf: 'Step',
    branch: 'Branch',
    chooseBranch: 'Choose a branch',
    equipment: 'Equipment',
    equipmentHint:
      'Search by equipment number or name. Results are limited to the selected branch.',
    equipmentSearch: 'Browse or search equipment by number or name',
    searchHelp: 'Open the list to browse equipment for this branch, or type to filter. Paste several numbers separated by commas, semicolons, spaces or new lines to add them at once. Select up to 14 units.',
    searching: 'Searching Dataverse...',
    refineSearch: 'Showing the first 20 matches. Type to narrow the list.',
    pasteAdded: 'Equipment added from pasted list',
    pasteNotFound: 'Not found in this branch',
    pasteAlreadySelected: 'Already selected',
    pasteOverLimit: 'Not added (14-unit limit reached)',
    pasteTruncated: 'Only the first 50 pasted values were checked.',
    pasteChecking: 'Checking pasted equipment numbers...',
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
    packagesTitle: 'Select packages',
    packagesHint:
      'Mix standard, CSTM and T&M packages. Predefined costs scale with equipment. Save to view server pricing.',
    packageSearch: 'Search by package number, description or scope of work',
    packageSearchHelp: 'Open the list to browse every available package, or type to filter. Select as many packages as needed.',
    searchingPackages: 'Loading package catalog...',
    noPackages: 'No matching active packages found.',
    selectedPackages: 'Selected packages',
    addPackage: 'Add package',
    packagesAvailable: 'packages',
    packagesChosen: 'selected',
    showMore: 'Show more',
    scopeOfWork: 'Scope of work',
    noScope: 'No scope of work available.',
    packageLimit: 'All packages apply to all selected equipment. Request-size and processing safeguards apply.',
    reviewTitle: 'Review request details',
    customerName: 'Customer name',
    customerEmail: 'Customer email',
    customerPhone: 'Customer phone',
    buildingName: 'Building name',
    customerHint:
      'Review customer and building details. To edit them, return to Opportunity details.',
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
    packagesNav: 'Détails des forfaits',
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
    pricingHint: 'Utilisez Calculer ci-dessous pour enregistrer le brouillon et calculer les prix dans Dataverse. Après modification, utilisez Recalculer. Le prix saisi n’est pas un devis approuvé.',
    equipmentNote: 'Les noms des équipements proviennent de Dataverse. Les numéros non répertoriés restent sans correspondance.',
    costsTitle: 'Coûts et ajouts au devis',
    costsUnavailable: 'Enregistrez pour calculer les totaux serveur. Saisissez 5 pour 5 %. Les coûts des forfaits sont multipliés par les équipements ; les lignes personnalisées et les ajouts ne sont comptés qu’une fois. Évitez les doublons.',
    proposalPrice: 'Prix de la proposition',
    partnerTitle: 'Partenaires et notes CTT',
    selectedCount: 'Quantité d’équipements (unités sélectionnées)',
    workbookAlignment: 'Les prix sont calculés dans Dataverse. Les coûts mixtes et personnalisés suivent les règles confirmées ; la comparaison Excel reste nécessaire. L’envoi n’est pas connecté.',
    branchChangeWarning: 'Changer de succursale supprime les équipements et forfaits sélectionnés. Continuer ?',
    missingCountry: 'Cette succursale n’a pas de pays associé. La recherche de forfaits est impossible ; contactez un administrateur.',
    provinceFromBranch: 'Renseigné automatiquement à partir de la succursale sélectionnée.',
    missingProvince: 'Cette succursale n’a pas de province/état. Demandez à un administrateur de corriger les données.',
    stepEquipment: 'Équipement',
    stepPackages: 'Forfaits',
    stepReview: 'Vérification',
    stepOf: 'Étape',
    branch: 'Succursale',
    chooseBranch: 'Choisir une succursale',
    equipment: 'Équipement',
    equipmentHint:
      'Recherchez par numéro ou nom d’équipement. Les résultats sont limités à la succursale choisie.',
    equipmentSearch: 'Parcourir ou rechercher par numéro ou nom',
    searchHelp: 'Ouvrez la liste pour parcourir les équipements de cette succursale, ou saisissez pour filtrer. Collez plusieurs numéros séparés par des virgules, points-virgules, espaces ou retours à la ligne pour les ajouter en une fois. Sélectionnez jusqu’à 14 unités.',
    searching: 'Recherche dans Dataverse…',
    refineSearch: 'Affichage des 20 premiers résultats. Saisissez pour affiner.',
    pasteAdded: 'Équipements ajoutés depuis la liste collée',
    pasteNotFound: 'Introuvables dans cette succursale',
    pasteAlreadySelected: 'Déjà sélectionnés',
    pasteOverLimit: 'Non ajoutés (limite de 14 unités atteinte)',
    pasteTruncated: 'Seules les 50 premières valeurs collées ont été vérifiées.',
    pasteChecking: 'Vérification des numéros d’équipement collés…',
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
    packagesTitle: 'Choisir les forfaits',
    packagesHint:
      'Combinez les forfaits standard, CSTM et T&M. Les coûts prédéfinis varient selon le nombre d’équipements. Enregistrez pour voir les prix serveur.',
    packageSearch: 'Rechercher par numéro, description ou portée des travaux',
    packageSearchHelp: 'Ouvrez la liste pour parcourir tous les forfaits disponibles, ou saisissez pour filtrer. Sélectionnez autant de forfaits que nécessaire.',
    searchingPackages: 'Chargement du catalogue…',
    noPackages: 'Aucun forfait actif correspondant.',
    selectedPackages: 'Forfaits sélectionnés',
    addPackage: 'Ajouter le forfait',
    packagesAvailable: 'forfaits',
    packagesChosen: 'sélectionné(s)',
    showMore: 'Afficher plus',
    scopeOfWork: 'Portée des travaux',
    noScope: 'Aucune portée des travaux disponible.',
    packageLimit: 'Chaque forfait s’applique à tous les équipements sélectionnés. Des limites techniques de taille et de traitement s’appliquent.',
    reviewTitle: 'Vérifier les détails de la demande',
    customerName: 'Nom du client',
    customerEmail: 'Courriel du client',
    customerPhone: 'Téléphone du client',
    buildingName: 'Nom de l’immeuble',
    customerHint:
      'Vérifiez les renseignements du client et de l’immeuble. Pour les modifier, revenez aux détails de l’opportunité.',
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

export type AppCopy = typeof copy.en

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected Dataverse error.'
}

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    new: 'M12 5v14 M5 12h14',
    requests: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5',
    estimator: 'M5 3h14v18H5z M8 7h8 M8 12h1 M12 12h1 M16 12h0 M8 16h1 M12 16h1 M16 16h0',
    pricing: 'M16 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7 M12 3v18',
    quotes: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5',
    data: 'M4 4h16v16H4z M4 9h16 M4 14h16 M10 4v16',
    reports: 'M4 3v18h17 M8 17v-5 M13 17V7 M18 17V4',
    settings: 'M9.5 2h5l.5 3 2 1.2 2.8-1 2.5 4.3-2.3 2v1l2.3 2-2.5 4.3-2.8-1-2 1.2-.5 3h-5l-.5-3-2-1.2-2.8 1-2.5-4.3 2.3-2v-1l-2.3-2 2.5-4.3 2.8 1L9 5l.5-3Z',
  }
  return (
    <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
      {name === 'settings' && <circle cx="12" cy="12" r="3" />}
    </svg>
  )
}

function App() {
  const [market, setMarket] = useState<Market>(126110000)
  const [systemDarkMode, setSystemDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [view, setView] = useState<View>('estimates')
  const [masterDirty, setMasterDirty] = useState(false)
  const [masterBusy, setMasterBusy] = useState(false)
  const settingsReturnView = useRef<View>('estimates')
  const [searchInput, setSearchInput] = useState('')
  const [requestSearch, setRequestSearch] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchLoading, setBranchLoading] = useState(true)
  const [branchError, setBranchError] = useState('')
  const [branchId, setBranchId] = useState('')
  const [equipmentQuery, setEquipmentQuery] = useState('')
  const [equipmentSearch, setEquipmentSearch] = useState<{ key: string; records: Equipment[]; error: string }>()
  const [equipmentSearchNonce, setEquipmentSearchNonce] = useState(0)
  const [equipmentBulkBusy, setEquipmentBulkBusy] = useState(false)
  const [equipmentBulkError, setEquipmentBulkError] = useState('')
  const [equipmentPasteResult, setEquipmentPasteResult] = useState<EquipmentPasteResult>()
  const equipmentPasteRequest = useRef(0)
  const [selectedEquipment, setSelectedEquipment] = useState<
    SelectedEquipment[]
  >([])
  const [packageCatalog, setPackageCatalog] = useState<{ key: string; records: RepairPackage[]; error: string }>()
  const [packageAttempt, setPackageAttempt] = useState(0)
  const [packageError, setPackageError] = useState('')
  const [selectedPackages, setSelectedPackages] = useState<Omit<RepairPackage, 're_effectivefrom' | 're_effectiveto'>[]>([])
  const [laborLines, setLaborLines] = useState<DraftLabor[]>([])
  const [materialLines, setMaterialLines] = useState<DraftMaterial[]>([])
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
  const [referencesNeeded, setReferencesNeeded] = useState(false)
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
  const [submitted, setSubmitted] = useState(false)
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
  const currentSnapshot = useMemo(() => JSON.stringify({
    branchId, stateId, estimateTitle, buildingName, customerName, customerEmail, customerPhone,
    equipmentTypeId, jobTypeId, market, requestInputs, selectedEquipment, selectedPackages, laborLines, materialLines,
  }), [branchId, stateId, estimateTitle, buildingName, customerName, customerEmail, customerPhone,
    equipmentTypeId, jobTypeId, market, requestInputs, selectedEquipment, selectedPackages, laborLines, materialLines])
  const draftDirty = savedSnapshot ? savedSnapshot !== currentSnapshot : Boolean(branchId || buildingName || estimateTitle
    || customerName || customerEmail || customerPhone || equipmentTypeId || jobTypeId || Object.values(requestInputs).some(Boolean))
  const hasUnsavedChanges = Boolean(preferences.unsaved || preferences.busy || draftBusy || draftDirty || masterDirty || masterBusy)
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
    if (!session?.canReadEstimates || !referencesNeeded) return
    const timeout = window.setTimeout(() => {
      void loadBranches()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadBranches, session?.canReadEstimates, referencesNeeded])

  useEffect(() => {
    if (!session?.canReadEstimates || !referencesNeeded) return
    let cancelled = false
    void getRequestReferences()
      .then((result) => { if (!cancelled) setReferences(result) })
      .catch((error: unknown) => { if (!cancelled) setReferenceError(message(error)) })
    return () => { cancelled = true }
  }, [session?.canReadEstimates, referenceAttempt, referencesNeeded])

  useEffect(() => {
    if (!session?.canReadEstimates || !referencesNeeded) return
    let cancelled = false
    void getDraftReferences().then((result) => {
      if (!cancelled) { setDraftReferences(result); setDraftReferenceError('') }
    }).catch((reason: unknown) => {
      if (!cancelled) setDraftReferenceError(message(reason))
    })
    return () => { cancelled = true }
  }, [session?.canReadEstimates, referenceAttempt, referencesNeeded])

  const equipmentSearchKey = branchId && step === 2 ? `${branchId}|${equipmentSearchNonce}|${equipmentQuery.trim()}` : ''

  useEffect(() => {
    if (!equipmentSearchKey) return
    const query = equipmentQuery.trim()
    let cancelled = false
    const timeout = window.setTimeout(() => {
      searchEquipment(branchId, query)
        .then((records) => {
          if (!cancelled) setEquipmentSearch({ key: equipmentSearchKey, records, error: '' })
        })
        .catch((error: unknown) => {
          if (!cancelled) setEquipmentSearch({ key: equipmentSearchKey, records: [], error: message(error) })
        })
    }, query ? 300 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [branchId, equipmentQuery, equipmentSearchKey])

  // Results are only shown for the exact branch/query they were fetched for, so stale lists never leak.
  const equipmentLoading = equipmentSearchKey !== '' && equipmentSearch?.key !== equipmentSearchKey
  const equipmentResults = equipmentSearch?.key === equipmentSearchKey ? equipmentSearch.records : []
  const equipmentError = equipmentBulkError || (equipmentSearch?.key === equipmentSearchKey ? equipmentSearch.error : '')

  const packageCountryId = selectedBranch?._re_country_value
  const packageKey = packageCountryId ? `${packageCountryId}:${packageAttempt}` : ''

  useEffect(() => {
    if (!packageCountryId) return
    let cancelled = false
    listPackages(packageCountryId)
      .then((records) => {
        if (!cancelled) setPackageCatalog({ key: packageKey, records, error: '' })
      })
      .catch((error: unknown) => {
        if (!cancelled) setPackageCatalog({ key: packageKey, records: [], error: message(error) })
      })
    return () => { cancelled = true }
  }, [packageCountryId, packageKey])

  const packageLoading = packageKey !== '' && packageCatalog?.key !== packageKey
  const packageResults = packageCatalog?.key === packageKey ? packageCatalog.records : []
  const packageLoadError = packageCatalog?.key === packageKey ? packageCatalog.error : ''

  const selectedPackageIds = useMemo(
    () => new Set(selectedPackages.map((repairPackage) => repairPackage.re_repairpackageid)),
    [selectedPackages],
  )

  function toggleEquipment(equipment: Equipment) {
    if (selectedEquipment.some((item) => item.number === equipment.re_equipment)) {
      setSelectedEquipment((current) => current.filter((item) => item.number !== equipment.re_equipment))
      return
    }
    if (selectedEquipment.length >= MAX_EQUIPMENT) return
    setSelectedEquipment((current) => [...current, toSelectedEquipment(equipment)])
  }

  async function addEquipmentList(text: string) {
    const parsed = parseEquipmentList(text)
    if (!branchId || parsed.length === 0) return
    const numbers = parsed.slice(0, MAX_PASTED_EQUIPMENT)
    const request = ++equipmentPasteRequest.current
    const requestBranch = branchId
    setEquipmentQuery('')
    setEquipmentPasteResult(undefined)
    setEquipmentBulkError('')
    setEquipmentBulkBusy(true)
    try {
      const matches = await findEquipmentByNumbers(requestBranch, numbers)
      if (request !== equipmentPasteRequest.current) return
      const plan = planEquipmentAdd(selectedEquipment.map((item) => item.number), numbers, matches)
      setSelectedEquipment((current) => {
        const present = new Set(current.map((item) => item.number))
        const room = Math.max(0, MAX_EQUIPMENT - current.length)
        return [...current, ...plan.add.filter((item) => !present.has(item.re_equipment)).slice(0, room).map(toSelectedEquipment)]
      })
      setEquipmentPasteResult({
        added: plan.add.map((item) => item.re_equipment), notFound: plan.notFound,
        alreadySelected: plan.alreadySelected, overLimit: plan.overLimit,
        truncated: parsed.length > numbers.length,
      })
    } catch (error) {
      if (request === equipmentPasteRequest.current) setEquipmentBulkError(message(error))
    } finally {
      if (request === equipmentPasteRequest.current) {
        setEquipmentBulkBusy(false)
        // Refresh the browse list so the dropdown reflects the empty query, not the pasted text.
        setEquipmentSearchNonce((current) => current + 1)
      }
    }
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
  }

  function resetBranch(nextBranchId: string) {
    equipmentPasteRequest.current++
    setEquipmentPasteResult(undefined)
    setEquipmentBulkBusy(false)
    setEquipmentBulkError('')
    setBranchId(nextBranchId)
    setEquipmentQuery('')
    setSelectedEquipment([])
    setSelectedPackages([])
    setLaborLines([]); setMaterialLines([])
    setPackageError('')
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
    if (!preferences.ready || preferences.busy || draftBusy || draftInFlight.current) return
    if (market === nextMarket) return
    const inWorkspace = view === 'new' || (view === 'settings' && settingsReturnView.current === 'new')
    if (inWorkspace) {
      if (draftVersion) return
      if (branchId && !window.confirm(t.marketChangeWarning)) return
      resetBranch('')
    } else {
      if (draftDirty && !window.confirm(dt.warning)) return
      if (!leaveMaster()) return
      resetDraftWorkspace()
    }
    setMarket(nextMarket)
    setStep(1)
    const french = nextMarket === 126110002
    void preferences.save({
      language: french ? 'fr' : 'en', locale: french ? 'fr-CA' : 'en-US', theme: preferences.theme,
    })
  }

  function changeEquipmentQuery(value: string) {
    setEquipmentQuery(value)
    setEquipmentBulkError('')
    setEquipmentPasteResult(undefined)
  }

  function togglePackage(repairPackage: RepairPackage) {
    if (selectedPackageIds.has(repairPackage.re_repairpackageid)) {
      setSelectedPackages((current) => current.filter((item) => item.re_repairpackageid !== repairPackage.re_repairpackageid))
      setPackageError('')
      return
    }
    if (selectedPackages.length + selectedEquipment.length + laborLines.length + materialLines.length >= MAX_DRAFT_CHILD_OPERATIONS) {
      setPackageError(language === 'fr' ? 'Limite technique atteinte. Divisez la demande.' : 'Technical processing budget reached. Split this request.')
      return
    }
    setPackageError('')
    setSelectedPackages((current) => [...current, repairPackage])
  }

  const dt = language === 'fr' ? {
    title: 'Nom du devis', province: 'Province / État du bâtiment', currency: 'Devise',
    save: 'Enregistrer le brouillon', saving: 'Enregistrement…', saved: 'Brouillon enregistré',
    open: 'Ouvrir le brouillon', working: 'Opération en cours…', new: 'Nouveau brouillon',
    warning: 'Des modifications ne sont pas enregistrées. Les abandonner ?',
    required: 'Renseignez le nom du devis, le client, le bâtiment, la province, les équipements, les forfaits, la langue, la catégorie de temps, la taxe et le fret.',
    note: 'Enregistrez un brouillon ou soumettez le devis depuis la vérification finale. La soumission valide les prix et verrouille les modifications, sans envoyer de courriel.',
    error: 'Opération impossible. Vérifiez que le service Dataverse re_DraftEstimate est déployé et que vos autorisations sont suffisantes. En cas de conflit ou de délai dépassé, rechargez le brouillon avant de réessayer.',
    reload: 'Recharger le brouillon', locked: 'La succursale et le marché sont fixes pour un brouillon enregistré.',
  } : {
    title: 'Estimate title', province: 'Building province / state', currency: 'Currency',
    save: 'Save draft', saving: 'Saving…', saved: 'Draft saved',
    open: 'Open draft', working: 'Operation in progress…', new: 'New draft',
    warning: 'There are unsaved changes. Discard them?',
    required: 'Complete estimate title, customer, building, province, equipment, packages, proposal language, time category, use tax and freight.',
    note: 'Save a draft or submit from Review. Submission validates pricing and locks editing; no email is sent.',
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
      re_iscustompackage: item.isCustom ?? false, re_istimematerial: item.isTimeMaterial ?? false,
    }))
    const labor = record.laborLines ?? []
    const materials = (record.materialLines ?? []).map((line) => ({ ...line, vendor: line.vendor ?? '', part: line.part ?? '' }))
    setLaborLines(labor); setMaterialLines(materials)
    setDraftId(record.id); setDraftVersion(record.version); setDraftNumber(record.number ?? '')
    setSavedSalesperson(record.salesperson ?? '')
    setPricingUnavailable(record.pricingState === 'unavailable')
    setSubmitted(record.status === 126110002)
    setEstimateTitle(record.title); setBranchId(record.branchId); setStateId(record.stateId)
    setBuildingName(record.building); setCustomerName(record.customer)
    setCustomerEmail(record.email ?? ''); setCustomerPhone(record.phone ?? '')
    setEquipmentTypeId(record.equipmentTypeId); setJobTypeId(record.jobTypeId ?? '')
    setMarket(record.market); setRequestInputs(inputs); setSelectedEquipment(equipment); setSelectedPackages(packages)
    setEquipmentQuery('')
    setSavedSnapshot(JSON.stringify({
      branchId: record.branchId, stateId: record.stateId, estimateTitle: record.title,
      buildingName: record.building, customerName: record.customer, customerEmail: record.email ?? '',
      customerPhone: record.phone ?? '', equipmentTypeId: record.equipmentTypeId, jobTypeId: record.jobTypeId ?? '',
      market: record.market, requestInputs: inputs, selectedEquipment: equipment, selectedPackages: packages,
      laborLines: labor, materialLines: materials,
    }))
  }

  async function openDraft(id: string) {
    if (draftInFlight.current || (draftDirty && !window.confirm(dt.warning))) return
    draftInFlight.current = true
    setDraftBusy(true); setDraftError(''); setDraftNotice('')
    try {
      const record = await draftOperation({ mode: 'load', id })
      applyDraft(record); setReferencesNeeded(true); setStep(record.status === 126110002 ? 5 : 1); setView('new')
    } catch (reason) { setDraftError(`${dt.error} ${message(reason)}`) }
    finally { draftInFlight.current = false; setDraftBusy(false) }
  }

  async function saveDraft(submit = false) {
    if (draftInFlight.current || submitted) return
    setDraftError(''); setDraftNotice('')
    if (!draftComplete) { setDraftError(dt.required); return }
    const rateError = statedRateError(requestInputs.re_statedlaborrate, language)
    if (rateError) { setDraftError(rateError); setStep(1); return }
    if (submit && !(Number(requestInputs.re_sellprice) > 0)) {
      setDraftError(language === 'fr' ? 'Saisissez un prix de vente supérieur à zéro avant de soumettre.' : 'Enter a selling price greater than zero before submitting.')
      setStep(4); return
    }
    const controls = requestSection.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
    if (controls && !Array.from(controls).every((input) => input.reportValidity())) return
    if (submit && !window.confirm(language === 'fr'
      ? 'Soumettre ce devis ? Toutes les modifications seront enregistrées et le devis ne sera plus modifiable.'
      : 'Submit this estimate? All changes will be saved and the estimate will be locked against editing.')) return
    draftInFlight.current = true; setDraftBusy(true)
    try {
      const input: DraftRecord = {
        mode: submit ? 'submit' : 'save', id: draftId, version: draftVersion, title: estimateTitle,
        branchId, stateId, equipmentTypeId, jobTypeId, building: buildingName,
        customer: customerName, email: customerEmail, phone: customerPhone, market,
        fields: Object.entries(requestInputs).map(([key, value]) => ({ key, value: value ?? '' })),
        equipment: selectedEquipment.map((item) => ({ ...item, id: item.matched ? item.id : '' })),
        packages: selectedPackages.map((item) => ({ id: item.re_repairpackageid,
          number: item.re_packagenumber, nameEn: item.re_packagenameen, scopeEn: item.re_proposalscopeen ?? '',
          hours: 0, material: 0, isCustom: item.re_iscustompackage, isTimeMaterial: item.re_istimematerial })),
        laborLines, materialLines,
      }
      serializeDraft(input)
      const record = await draftOperation(input)
      if (submit && record.status !== 126110002) throw new Error(language === 'fr'
        ? 'La soumission n’a pas été confirmée par le serveur. Rechargez le devis avant de réessayer.'
        : 'Submission was not confirmed by the server. Reload the estimate before retrying.')
      applyDraft(record); setDraftNotice(`${submit ? language === 'fr' ? 'Devis soumis' : 'Estimate submitted' : dt.saved}: ${record.number || record.id}`)
    } catch (reason) { setDraftError(`${dt.error} ${submit ? submissionErrorMessage(message(reason), language) : message(reason)}`) }
    finally { draftInFlight.current = false; setDraftBusy(false) }
  }

  function resetDraftWorkspace() {
    setDraftId(crypto.randomUUID()); setDraftVersion(null); setDraftNumber(''); setSavedSnapshot('')
    setSavedSalesperson('')
    setPricingUnavailable(false)
    setSubmitted(false)
    setEstimateTitle(''); resetBranch(''); setStateId(''); setEquipmentTypeId(''); setJobTypeId('')
    setBuildingName(''); setCustomerName(''); setCustomerEmail(''); setCustomerPhone('')
    setRequestInputs({}); setDraftError(''); setDraftNotice(''); setStep(1)
  }

  function newDraft() {
    if (!canStart || draftInFlight.current || draftBusy || (draftDirty && !window.confirm(dt.warning))) return
    if (!leaveMaster()) return
    setReferencesNeeded(true)
    resetDraftWorkspace()
    setView('new')
  }

  function leaveMaster() {
    if (masterBusy) return false
    if (masterDirty && !window.confirm(language === 'fr'
      ? 'Des modifications des données de référence ne sont pas enregistrées. Les abandonner ?'
      : 'There are unsaved master-data changes. Discard them?')) return false
    setMasterDirty(false)
    return true
  }

  function navigate(next: View) {
    if (next === view || !leaveMaster()) return
    if (next === 'settings') settingsReturnView.current = view
    setView(next)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#home"
          onClick={(event) => {
            event.preventDefault()
            navigate('estimates')
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
            onClick={() => navigate('estimates')}
          >
            <NavigationIcon name="dashboard" />
            {t.estimates}
          </button>
          <button
            className={`nav-item ${view === 'new' ? 'active' : ''}`}
            onClick={newDraft}
            disabled={!canStart || draftBusy}
          >
            <NavigationIcon name="new" />
            {t.newEstimate}
          </button>
          <button
            className={`nav-item ${view === 'requests' ? 'active' : ''}`}
            onClick={() => navigate('requests')}
            disabled={!session?.canReadEstimates}
          >
            <NavigationIcon name="requests" />
            {t.repairRequests}
          </button>
          <button className={`nav-item ${view === 'packages' ? 'active' : ''}`}
            onClick={() => navigate('packages')} disabled={!session?.role}>
            <NavigationIcon name="data" />{t.packagesNav}
          </button>
          {session?.role === 'admin' && <button className={`nav-item ${view === 'master' ? 'active' : ''}`}
            onClick={() => navigate('master')}>
            <NavigationIcon name="data" />{t.masterDataNav}
          </button>}
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')} disabled={!session?.role}>
            <NavigationIcon name="settings" />{t.settingsNav}
          </button>
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
              if (!leaveMaster()) return
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
              <select aria-label={t.market} value={market} disabled={!preferences.ready || preferences.busy || draftBusy
                || (Boolean(draftVersion) && (view === 'new' || (view === 'settings' && settingsReturnView.current === 'new')))} onChange={(event) => {
                const value = Number(event.target.value)
                if (value === 126110000 || value === 126110001 || value === 126110002) changeMarket(value)
              }}>
                <option value={126110000}>MKO</option>
                <option value={126110001}>CKE</option>
                <option value={126110002}>CKQ</option>
              </select>
            </label>
            <span className="role-label">{roleLabel}</span>
            <button className="button secondary settings-control" aria-label={t.settingsNav}
              disabled={!session?.role || masterBusy} onClick={() => navigate('settings')}>
              <NavigationIcon name="settings" />
            </button>
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
          {pricingUnavailable && <p className="draft-notice" role="alert">
            {pricingUnavailableMessage(language)}
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
          {view === 'settings' ? (
            session?.role && <Settings preferences={preferences} onClose={() => navigate(settingsReturnView.current)} />
          ) : view === 'master' || view === 'packages' ? (
            session?.role && <LazyWorkspace key={view} load={loadMaster} language={language} workspaceProps={{
              language, admin: session.role === 'admin', catalog: view === 'packages',
              onDirtyChange: setMasterDirty, onBusyChange: setMasterBusy,
            }} />
          ) : view === 'requests' ? (
            session?.canReadEstimates ?
            <section className="page-content">
              <div className="page-heading"><div>
                <h1>{t.repairRequests}</h1>
                <p>{t.recentRequestsHint}</p>
              </div></div>
              <section className="dashboard-card"><EstimateList key={market} market={market} ownerId={session.role === 'admin' ? null : session.userId} search={requestSearch} language={language} onOpen={(id) => void openDraft(id)} busy={draftBusy} /></section>
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
                <button className="button primary" onClick={newDraft} disabled={!canStart || draftBusy}>
                  <span aria-hidden="true">+</span>
                  {t.startEstimate}
                </button>
              </div>
              {session?.canReadEstimates && <DashboardMetrics market={market} owner={session.role === 'admin' ? null : session.userId} language={language} />}
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
                {session?.canReadEstimates && <EstimateList recent key={market} market={market} ownerId={session.role === 'admin' ? null : session.userId} language={language} onOpen={(id) => void openDraft(id)} busy={draftBusy} />}
              </section>
            </section>
          ) : (
            <LazyWorkspace load={loadEstimator} language={language} workspaceProps={{
              requestSection,
              t,
              draftVersion,
              draftDirty,
              dt,
              draftNumber,
              newDraft,
              draftBusy,
              canStart,
              openDraft,
              draftId,
              canWork,
              draftComplete,
              saveDraft, submitted,
              step,
              estimateTitle,
              setEstimateTitle,
              draftReferences,
              selectedBranch,
              draftReferenceError,
              setReferenceAttempt,
              branchLoading,
              branchError,
              loadBranches,
              market,
              marketBranches,
              branchId,
              changeBranch,
              language,
              referenceError,
              setReferenceError,
              references,
              equipmentTypeId,
              setEquipmentTypeId,
              jobTypeId,
              setJobTypeId,
              savedSalesperson,
              session,
              buildingName,
              setBuildingName,
              stateId,
              updateRequestInput,
              requestInputs,
              equipmentQuery,
              changeEquipmentQuery,
              equipmentLoading,
              equipmentError,
              equipmentResults,
              equipmentBulkBusy,
              toggleEquipment,
              selectedEquipment,
              addUnlistedEquipment,
              addEquipmentList,
              equipmentPasteResult,
              setSelectedEquipment,
              selectedPackages,
              laborLines, materialLines, setLaborLines, setMaterialLines,
              packageLoading,
              packageError: packageError || packageLoadError,
              packageResults,
              togglePackage,
              retryPackages: () => setPackageAttempt((current) => current + 1),
              selectedPackageIds,
              setSelectedPackages,
              marketName,
              customerName,
              setCustomerName,
              customerEmail,
              setCustomerEmail,
              customerPhone,
              setCustomerPhone,
              setStep,
              onDashboard: () => setView('estimates'),
            }} />
          )}
          </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
