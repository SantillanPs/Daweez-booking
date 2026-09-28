/**
 * The agency details the booking form keeps while an agency is paying.
 *
 * They live in their own module because `AgencyFields` must export **only components**
 * (`react-refresh/only-export-components`), and because the form and the field component
 * both need the shape.
 */
export interface AgencyValues {
  dealId: string
  name: string
  address: string
  contact: string
  tin: string
  plate: string
}

export const EMPTY_AGENCY: AgencyValues = {
  dealId: '', name: '', address: '', contact: '', tin: '', plate: '',
}
