import { EventEmitter } from "events";

export interface CreateOptions {
  title?: string
  description?: string
  type?: string
}

export interface SelectArchiveOptions {
  title?: string
  buttonLabel?: string
  filters?: {
    isOwner: boolean
    type?: string | string[]
  }
}

export interface Hypercore {
  key: Buffer
  secretKey: Buffer
  length: number
  byteLength: number
  downloaded(): number
}

export interface Hyperdrive {
  key: Buffer
  writable: boolean
  content: Hypercore
  metadata: Hypercore
  checkout(version: number): Hyperdrive
  createReadStream(path, opts?): EventEmitter
}

export interface DatArchive {
  url: string
  _dataStructure: Hyperdrive
  _checkout: Hyperdrive
  _version: number
  getInfo(opts?): Promise<any>
  stat(filepath: string, opts?): Promise<any>
  readdir(path: string, opts?)
}