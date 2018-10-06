
module.exports = {
  DNSLookupFailed: class DNSLookupFailed extends Error {
    constructor(msg) {
      super(msg);
    }
  },
}