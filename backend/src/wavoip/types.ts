export interface WavoipCall {
  id: string | number;
  caller?: string;
  receiver?: string;
  from?: string;
  to?: string;
  direction?: string;
  duration?: number;
  status: string;
  created_date?: string;
  createdAt?: string;
  whatsapp_call_id?: string;
}

export interface WavoipDevice {
  id: string;
  id_user?: string;
  name: string;
  phone?: string;
  token?: string;
  status: string;
}
