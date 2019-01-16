
export interface CreateOptions {
  title?: string
  description?: string
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
}

export interface DatArchive {
  url: string
  _dataStructure: Hyperdrive
  getInfo(opts?): Promise<any>
  stat(filepath: string, opts?): Promise<any>
  readdir(path: string, opts?)
}