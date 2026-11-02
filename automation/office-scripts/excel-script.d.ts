// Minimal local declarations for the Office Scripts methods used here. Excel supplies the real API at runtime.
declare namespace ExcelScript {
  enum InsertShiftDirection { down }
  enum RangeCopyType { all }
  enum ClearApplyTo { contents }
  interface Range {
    getValue(): string | number | boolean
    getRowIndex(): number
    setValue(value: string | number | boolean): void
    setValues(values: (string | number | boolean)[][]): void
    setNumberFormat(format: string): void
    getFormat(): RangeFormat
    getEntireRow(): Range
    insert(direction: InsertShiftDirection): Range
    copyFrom(source: Range, copyType: RangeCopyType): void
    clear(applyTo: ClearApplyTo): void
  }
  interface RangeFormat {
    getFill(): RangeFill
    getFont(): RangeFont
    setWrapText(value: boolean): void
    setRowHeight(value: number): void
    setColumnWidth(value: number): void
  }
  interface RangeFont { setBold(value: boolean): void }
  interface RangeFill { setColor(color: string): void }
  interface NamedItem { getRange(): Range }
  interface Table { setName(name: string): void }
  interface Worksheet {
    getRangeByIndexes(row: number, column: number, rows: number, columns: number): Range
    getUsedRange(): Range | undefined
    addTable(range: Range, hasHeaders: boolean): Table
    getPageLayout(): PageLayout
  }
  interface PageLayout { setPrintArea(range: Range): void }
  interface Workbook {
    getNamedItem(name: string): NamedItem | undefined
    getWorksheet(name: string): Worksheet | undefined
    getWorksheets(): Worksheet[]
    addWorksheet(name: string): Worksheet
  }
}
