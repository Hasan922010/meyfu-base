/**
 * Bluetooth termal printerga ESC/POS yuborish (v5 C3) — Web Bluetooth (Android Chrome).
 *
 * iOS Safari Web Bluetooth'ni qo'llamaydi — u yerda PDF/ulashish ishlatiladi.
 * Ulangan printer sessiya davomida eslab qolinadi (har chekda qayta tanlanmaydi).
 */

// TypeScript DOM kutubxonasida Web Bluetooth turlari yo'q — faqat kerakli qism
interface BtCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}
interface BtService {
  getCharacteristics(): Promise<BtCharacteristic[]>;
}
interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  getPrimaryServices(): Promise<BtService[]>;
}
interface BtDevice {
  name?: string;
  gatt?: BtServer;
}
interface BtNavigator {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices?: boolean;
      filters?: Array<{ services: Array<number | string> }>;
      optionalServices?: Array<number | string>;
    }): Promise<BtDevice>;
  };
}

// Keng tarqalgan arzon printerlar (Xprinter, GOOJPRT, MTP va h.k.) servislari
const PRINTER_SERVICES: Array<number | string> = [
  0x18f0,
  0xff00,
  0xffe0,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];
const CHUNK = 128; // BLE paket chegarasi — katta bo'laklarni printer yo'qotadi

let device: BtDevice | null = null;
let characteristic: BtCharacteristic | null = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && (navigator as BtNavigator).bluetooth !== undefined;
}

export function connectedPrinterName(): string | null {
  return device?.name ?? null;
}

async function findWritable(server: BtServer): Promise<BtCharacteristic> {
  for (const service of await server.getPrimaryServices()) {
    for (const ch of await service.getCharacteristics()) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
    }
  }
  throw new Error('Printerda yozish kanali topilmadi.');
}

async function ensureConnected(): Promise<BtCharacteristic> {
  const bt = (navigator as BtNavigator).bluetooth;
  if (!bt) throw new Error('Bu brauzer Bluetooth printerni qo‘llamaydi.');
  if (!device) {
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });
    characteristic = null;
  }
  const gatt = device.gatt;
  if (!gatt) throw new Error('Printerga ulanib bo‘lmadi.');
  if (!gatt.connected || !characteristic) {
    const server = await gatt.connect();
    characteristic = await findWritable(server);
  }
  return characteristic;
}

/** Baytlarni printerga bo'laklab yuboradi. */
export async function printBytes(data: Uint8Array): Promise<void> {
  const ch = await ensureConnected();
  for (let i = 0; i < data.length; i += CHUNK) {
    const part = data.slice(i, i + CHUNK);
    if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) {
      await ch.writeValueWithoutResponse(part);
    } else {
      await ch.writeValue(part);
    }
  }
}

/** Boshqa printer tanlash uchun eslab qolinganini unutadi. */
export function forgetPrinter(): void {
  device = null;
  characteristic = null;
}

const WIDTH_KEY = 'meyfu.printer.width';

/** Qog'oz eni: 58 mm (32 belgi) yoki 80 mm (48 belgi). Faqat shu qurilmada saqlanadi. */
export function getPaperWidth(): 32 | 48 {
  try {
    return localStorage.getItem(WIDTH_KEY) === '48' ? 48 : 32;
  } catch {
    return 32;
  }
}

export function setPaperWidth(width: 32 | 48): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // saqlab bo'lmasa — standart 58 mm ishlatiladi
  }
}
