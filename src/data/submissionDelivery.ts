import type { ExportDeliveryState } from './draftContract'

const messages: Record<'en' | 'fr', Record<ExportDeliveryState, string>> = {
  en: {
    pending: 'Submission queued. Waiting for Excel generation.',
    generating: 'Generating the submission workbook.',
    generated: 'Workbook generated. Preparing the email attachment.',
    sending: 'Sending the internal submission email. Do not resubmit.',
    accepted: 'Email accepted by Outlook. Finalizing the submission.',
    completed: 'Estimate submitted. Outlook accepted the email with the Excel attachment.',
    failed: 'Automation failed before email sending. The estimate remains locked. Contact the flow owner for recovery.',
    'needs-review': 'Email delivery is uncertain. The estimate remains locked. The flow owner must review the send result before any retry.',
  },
  fr: {
    pending: 'Soumission en attente. Génération Excel à venir.',
    generating: 'Génération du classeur de soumission.',
    generated: 'Classeur généré. Préparation de la pièce jointe.',
    sending: 'Envoi du courriel interne. Ne soumettez pas à nouveau.',
    accepted: 'Courriel accepté par Outlook. Finalisation de la soumission.',
    completed: 'Devis soumis. Outlook a accepté le courriel avec la pièce jointe Excel.',
    failed: 'Échec avant l’envoi du courriel. Le devis reste verrouillé. Contactez le responsable du flux.',
    'needs-review': 'Envoi du courriel incertain. Le devis reste verrouillé. Le responsable doit vérifier le résultat avant toute nouvelle tentative.',
  },
}

export function submissionDeliveryMessage(state: ExportDeliveryState, language: 'en' | 'fr'): string {
  return messages[language][state]
}
