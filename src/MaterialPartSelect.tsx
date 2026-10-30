import { useEffect, useState } from 'react'
import type { DraftMaterial } from './data/draftContract'
import type { Market } from './data/estimateQuery'
import { getPartCatalog, type CatalogResult } from './data/partCatalogRepository'

export function MaterialPartSelect({ line, update, market, language, capability, readOnly }: {
  line: DraftMaterial; update: (change: Partial<DraftMaterial>) => void; market: Market
  language: 'en' | 'fr'; capability?: CatalogResult; readOnly: boolean
}) {
  const fr = language === 'fr'
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ key: string; result?: CatalogResult; error?: string }>()
  const key = `${market}:${line.partType}:${query.trim()}`
  useEffect(() => {
    if (!capability?.available || !line.partType || query.trim().length < 2 || readOnly) return
    let active = true
    const timer = setTimeout(() => {
      getPartCatalog(market, query.trim(), line.partType ?? undefined).then(
        (result) => { if (active) setSearch({ key, result }) },
        (reason: unknown) => { if (active) setSearch({ key, error: reason instanceof Error ? reason.message : String(reason) }) },
      )
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [capability?.available, key, line.partType, market, query, readOnly])
  const current = search?.key === key ? search : undefined
  const money = (value: number) => `${value.toLocaleString(fr ? 'fr-CA' : 'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 10 })}${capability?.currency ? ` ${capability.currency}` : ''}`
  return <>
    <label className="field-label">{fr ? 'Type de pièce' : 'Part type'}
      <select className="text-input" value={line.partType ?? ''} disabled={readOnly || !capability?.available}
        onChange={(event) => {
          setQuery('')
          const partType = event.target.value === 'kone' ? 'kone' : event.target.value === 'non-kone' ? 'non-kone' : undefined
          update({ partType, catalogPartId: undefined, part: '', description: '', vendor: '',
            unitCost: 0, unitPrice: undefined, uom: undefined, refreshPart: false,
            markupPercent: partType === 'kone' ? capability?.defaultMarkupPercent : undefined })
        }}>
        {!line.partType && <option value="">{fr ? 'Saisie manuelle existante' : 'Existing manual entry'}</option>}
        <option value="kone">KONE</option><option value="non-kone">Non-KONE</option>
      </select>
    </label>
    {line.partType && !readOnly && capability?.available && <>
      <label className="field-label">{fr ? 'Rechercher une pièce du catalogue' : 'Search catalog part'}
        <input className="text-input" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {query.trim().length >= 2 && <div className="field-label">
        {!current && <p role="status">{fr ? 'Recherche des pièces…' : 'Searching parts…'}</p>}
        {current?.error && <p className="error-box" role="alert">{current.error}</p>}
        {current?.result && (!current.result.available
          ? <p className="error-box" role="alert">{current.result.reason}</p>
          : <>
            <label>{fr ? 'Résultats du catalogue' : 'Catalog results'}
              <select className="text-input" value="" onChange={(event) => {
                const part = current.result?.parts.find((item) => item.id === event.target.value)
                if (!part) return
                update({ catalogPartId: part.id, description: part.description, part: part.number,
                  vendor: part.partType === 'kone' ? 'KONE' : '', unitCost: part.unitCost,
                  unitPrice: part.unitPrice, uom: part.uom, refreshPart: true })
                setQuery('')
              }}>
                <option value="">{fr ? 'Choisir une pièce' : 'Select a part'}</option>
                {current.result.parts.map((part) => <option key={part.id} value={part.id}>{part.number} — {part.description}</option>)}
              </select>
            </label>
            {!current.result.parts.length && <p role="status">{fr ? 'Aucune pièce trouvée.' : 'No matching parts.'}</p>}
            {current.result.more && <p className="field-help">{fr ? '20 premiers résultats. Affinez la recherche.' : 'First 20 matches. Refine your search.'}</p>}
          </>)}
      </div>}
      {line.partType === 'non-kone' && line.catalogPartId && <button type="button" className="button tertiary"
        onClick={() => update({ catalogPartId: undefined, unitPrice: undefined, uom: undefined,
          unitCost: 0, part: '', description: '', refreshPart: false })}>
        {fr ? 'Passer à la saisie manuelle' : 'Switch to manual entry'}
      </button>}
      {line.partType === 'non-kone' && !line.catalogPartId && <p className="field-help">
        {fr ? 'Choisissez une pièce ou saisissez les détails manuellement dans la devise du devis.'
          : 'Select a part or enter details manually in the estimate currency.'}</p>}
      {line.partType === 'kone' && !line.catalogPartId && <p className="error-box" role="alert">
        {fr ? 'Choisissez une pièce KONE du catalogue avant d’enregistrer.' : 'Select a KONE catalog part before saving.'}</p>}
    </>}
    {line.partType === 'kone' && <label className="field-label">{fr ? 'Majoration KONE (%)' : 'KONE markup (%)'}
      <input className="text-input" type="number" min="0" max="100" step="0.01"
        value={line.markupPercent ?? ''} disabled={readOnly || !capability?.available}
        onChange={(event) => update({ markupPercent: event.target.value === '' ? undefined : Number(event.target.value) })} />
      <span className="field-help">{fr ? 'Appliquée au prix VK13, pas au coût interne.' : 'Applied to VK13 selling price, not internal cost.'}</span>
    </label>}
    {line.catalogPartId && <p className="field-help">
      {fr ? 'Pièce du catalogue' : 'Catalog part'}: {line.part} · {line.uom}
      {line.unitPrice != null && <> · VK13: {money(line.unitPrice)}</>}
      {' · '}{fr ? 'Valeurs vérifiées par le serveur lors de l’enregistrement.' : 'Values verified by the server on save.'}
    </p>}
  </>
}
