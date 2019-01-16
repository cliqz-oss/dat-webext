
declare namespace browser.processScript {
  function setAPIScript(path: string): void
  function sendMessage(message: object): void
}

declare namespace browser.protocol {
  type Request = {
    url: string
  }
  type Response = {
    contentType?: string
    content: AsyncIterableIterator<ArrayBuffer>
  }
  function registerProtocol(name: string, handler: (request: Request) => Response): void
}

declare module '@sammacbeth/dat-archive-web' {
  class DatArchive {
    static DefaultManager: any
    _archive: any
    closed: boolean
    url: string
    static setManager(manager): void
    static create(opts: any): any
    static fork(url: string, opts: any): any
    constructor(url: string)
  }
}
