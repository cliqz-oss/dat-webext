
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

export interface DatArchive {

}

export class DatArchiveImpl {
  url: string
  closed: boolean
  _loadPromise: Promise<void>

  constructor(url) {
    this.url = url;
    this.closed = false;
  }

  async _load(storage): Promise<void> {

  }
}

