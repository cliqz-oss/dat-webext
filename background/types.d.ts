
declare namespace browser.processScript {
  function setAPIScript(path: string): void
  function sendMessage(message: object): void
}

declare namespace browser.test {
  interface Assert {
    fail(message?: string): void
    pass(message?: string): void
    ok(v: boolean, message?: string): void
    equal(actual: any, expected: any, message?: string): void
    notEqual(actual: any, expected: any, message?: string): void
    deepEqual(actual: any, expected: any, message?: string): void
    notDeepEqual(actual: any, expected: any, message?: string): void
    deepLooseEqual(actual: any, expected: any, message?: string): void
    notDeepLooseEqual(actual: any, expected: any, message?: string): void
    throws(fn: Function, expected: RegExp|Function, message?: string): void
    doesNotThrow(fn: Function, message?: string): void
  }
  function test(name: string, test: (assert: Assert) => Promise<void>): void
}

declare namespace browser.protocol {
  type Request = {
    url: string
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

