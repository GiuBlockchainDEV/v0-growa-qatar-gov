import { validFoodUuid } from '@/lib/food-security/ingestion'

export const NFII_OPERATION_KINDS = [
  'supplier', 'contract', 'purchase_order', 'shipment',
  'warehouse', 'lot', 'release',
] as const
export type NfiiOperationKind = (typeof NFII_OPERATION_KINDS)[number]

type FieldType = 'code' | 'label' | 'text' | 'country' | 'uuid' | 'date' | 'quantity'
export interface OperationField {
  key: string
  en: string
  ar: string
  type: FieldType
  max?: number
}

export const OPERATION_FIELDS: Record<NfiiOperationKind, readonly OperationField[]> = {
  supplier: [
    { key:'code',en:'Supplier code',ar:'رمز المورد',type:'code',max:60 },
    { key:'name',en:'Supplier legal name',ar:'الاسم القانوني للمورد',type:'label',max:200 },
    { key:'countryCode',en:'Country (ISO 2 letters)',ar:'رمز الدولة (حرفان)',type:'country' },
  ],
  contract: [
    { key:'supplierId',en:'Approved supplier',ar:'المورد المعتمد',type:'uuid' },
    { key:'contractRef',en:'Contract reference',ar:'مرجع العقد',type:'code',max:80 },
    { key:'commodityCode',en:'Commodity',ar:'السلعة',type:'code',max:50 },
    { key:'contractedTonnes',en:'Contracted quantity (t)',ar:'الكمية المتعاقد عليها (طن)',type:'quantity' },
    { key:'priceQarPerTonne',en:'Price (QAR / t)',ar:'السعر (ريال/طن)',type:'quantity' },
    { key:'validFrom',en:'Valid from',ar:'ساري من',type:'date' },
    { key:'validTo',en:'Valid until',ar:'ساري حتى',type:'date' },
  ],
  purchase_order: [
    { key:'contractId',en:'Approved contract',ar:'العقد المعتمد',type:'uuid' },
    { key:'orderRef',en:'Purchase order number',ar:'رقم أمر الشراء',type:'code',max:80 },
    { key:'orderedTonnes',en:'Ordered quantity (t)',ar:'الكمية المطلوبة (طن)',type:'quantity' },
  ],
  shipment: [
    { key:'purchaseOrderId',en:'Approved purchase order',ar:'أمر الشراء المعتمد',type:'uuid' },
    { key:'shipmentRef',en:'Shipment / BL reference',ar:'مرجع الشحنة / بوليصة الشحن',type:'code',max:80 },
    { key:'shipmentTonnes',en:'Shipment quantity (t)',ar:'كمية الشحنة (طن)',type:'quantity' },
    { key:'origin',en:'Origin / port',ar:'المنشأ / الميناء',type:'label',max:160 },
    { key:'destination',en:'Destination / port',ar:'الوجهة / الميناء',type:'label',max:160 },
    { key:'etaDate',en:'Estimated arrival',ar:'الوصول المتوقع',type:'date' },
  ],
  warehouse: [
    { key:'code',en:'Warehouse code',ar:'رمز المستودع',type:'code',max:60 },
    { key:'name',en:'Warehouse name',ar:'اسم المستودع',type:'label',max:160 },
    { key:'location',en:'Location / zone',ar:'الموقع / المنطقة',type:'label',max:180 },
  ],
  lot: [
    { key:'warehouseId',en:'Approved warehouse',ar:'المستودع المعتمد',type:'uuid' },
    { key:'shipmentId',en:'Delivered shipment',ar:'الشحنة المستلمة',type:'uuid' },
    { key:'lotRef',en:'Lot / batch reference',ar:'مرجع الدفعة',type:'code',max:80 },
    { key:'receivedTonnes',en:'Received usable quantity (t)',ar:'الكمية المستلمة الصالحة (طن)',type:'quantity' },
    { key:'expiryDate',en:'Best-before / expiry date',ar:'تاريخ انتهاء الصلاحية',type:'date' },
  ],
  release: [
    { key:'lotId',en:'Approved reserve lot',ar:'دفعة المخزون المعتمدة',type:'uuid' },
    { key:'releaseRef',en:'Release request number',ar:'رقم طلب الصرف',type:'code',max:80 },
    { key:'quantityTonnes',en:'Quantity to release (t)',ar:'كمية الصرف (طن)',type:'quantity' },
    { key:'purpose',en:'Purpose / destination',ar:'الغرض / الوجهة',type:'text',max:1000 },
  ],
}

export type OperationValidation =
  | { ok: true; value: { organizationId: string; kind: NfiiOperationKind; data: Record<string,string | number> } }
  | { ok: false; error: string }

function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(value + 'T00:00:00.000Z')
  return Number.isNaN(d.valueOf()) || d.toISOString().slice(0,10) !== value ||
    value.slice(0,4) < '2000' || value.slice(0,4) > '2100' ? null : value
}

function parseField(field: OperationField, raw: unknown): string | number {
  if (typeof raw !== 'string' && typeof raw !== 'number') throw new Error(field.key + ' required')
  const value = String(raw).trim()
  const limit = field.max ?? 200
  switch (field.type) {
    case 'code':
      if (value.length > limit || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,79}$/.test(value)) {
        throw new Error(field.key + ' must be a stable code (3-' + limit + ' characters)')
      }
      return value
    case 'label':
      if (value.length < 3 || value.length > limit || /[\x00-\x1F\x7F<>]/.test(value)) {
        throw new Error(field.key + ' must contain 3-' + limit + ' valid characters')
      }
      return value
    case 'text':
      if (value.length < 8 || value.length > limit || /[\x00-\x1F\x7F<>]/.test(value)) {
        throw new Error(field.key + ' must contain 8-' + limit + ' valid characters')
      }
      return value
    case 'uuid':
      if (!validFoodUuid(value)) throw new Error(field.key + ' requires an existing record')
      return value
    case 'country':
      if (!/^[A-Z]{2}$/.test(value)) throw new Error('countryCode must use ISO 2-letter uppercase')
      return value
    case 'date': {
      const date = parseDate(value)
      if (!date) throw new Error(field.key + ' must be a valid YYYY-MM-DD date')
      return date
    }
    case 'quantity': {
      if (!/^\d{1,12}(?:\.\d{1,3})?$/.test(value)) {
        throw new Error(field.key + ' must be a positive decimal with at most 3 fractional digits')
      }
      const amount = Number(value)
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
        throw new Error(field.key + ' must be above zero and at most 1,000,000,000')
      }
      // priceQarPerTonne is NUMERIC(18,2), so reject rounding surprises.
      if (field.key === 'priceQarPerTonne' && !/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
        throw new Error('Price can have at most 2 decimal places')
      }
      return amount
    }
  }
}

export function validateNfiiOperation(raw: unknown): OperationValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {ok:false,error:'Expected operation object'}
  }
  const body=raw as Record<string,unknown>
  if (Object.keys(body).some(k=>!['organizationId','kind','data'].includes(k))) {
    return {ok:false,error:'Unexpected or privileged operation field'}
  }
  const kind=body.kind
  if (typeof kind !== 'string' || !(NFII_OPERATION_KINDS as readonly string[]).includes(kind)) {
    return {ok:false,error:'Invalid operation kind'}
  }
  if (!validFoodUuid(body.organizationId)) return {ok:false,error:'Invalid organizationId'}
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    return {ok:false,error:'data must be an object'}
  }
  const fields=OPERATION_FIELDS[kind as NfiiOperationKind]
  const data=body.data as Record<string,unknown>
  if (Object.keys(data).some(key=>!fields.some(f=>f.key===key))) {
    return {ok:false,error:'Unexpected or privileged data column'}
  }
  const parsed:Record<string,string|number>={}
  try {
    for(const field of fields)parsed[field.key]=parseField(field,data[field.key])
    if (kind==='contract' && String(parsed.validTo)<String(parsed.validFrom)) {
      throw new Error('Contract validity end cannot precede start')
    }
    return {ok:true,value:{
      organizationId:body.organizationId,kind:kind as NfiiOperationKind,data:parsed,
    }}
  }catch(error){
    return {ok:false,error:error instanceof Error?error.message:'Invalid operation'}
  }
}

export function validActionNote(note: unknown): note is string {
  return typeof note === 'string' && note.trim().length >= 8 &&
    note.trim().length <= 2000 && !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(note)
}
