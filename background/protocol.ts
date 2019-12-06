import createHandler, { IsADirectoryError, NotFoundError, NetworkTimeoutError } from '@sammacbeth/dat-protocol-handler';
import mime = require('mime');
import parseUrl = require('parse-dat-url');
import { DatAPI } from './dat';
import { DNSLookupFailed } from './errors';
import DatDNS from './dns';

class DatHandler {

  handler: (url: string, timeout?: number) => Promise<NodeJS.ReadableStream>;

  constructor(public dns: DatDNS, public node: DatAPI) {
    this.dns = dns;
    this.node = node;
    this.handler = createHandler(this.node, (host) => dns.resolve(host), {
      persist: true,
      autoSwarm: true,
      sparse: true,
    });
  }

  handleRequest(request: browser.protocol.Request): Response {
    const self = this;
    const { pathname } = parseUrl(request.url);
    const body = new ReadableStream({
      async start(controller) {
        try {
          const stream = await self.handler(request.url, 30000);
          let streamComplete;
          let gotFirstChunk = false
          const streamTimeout = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              if (!gotFirstChunk) {
                return reject(new Error('timeout'));
              }
              return resolve();
            }, 30000);
            streamComplete = () => {
              clearTimeout(timeout);
              resolve();
            };
          })
          stream.on('close', () => {
            controller.close();
          });
          stream.on('end', () => {
            controller.close();
            streamComplete();
          });
          stream.on('error', (e) => {
            controller.error(e);
          });
          stream.on('data', (chunk) => {
            gotFirstChunk = true;
            controller.enqueue(chunk);
          });
          await streamTimeout;
        } catch (e) {
          if (e instanceof DNSLookupFailed) {
            controller.enqueue(`Dat DNS Lookup failed for ${e.message}`);
          } else if (e instanceof NetworkTimeoutError) {
            controller.enqueue('Unable locate the Dat archive on the network.');
          } else if (e instanceof NotFoundError) {
            controller.enqueue(`Not found: ${e.toString()}`);
          } else if (e instanceof IsADirectoryError) {
            const req = await fetch('/pages/directory.html');
            const contents = await req.text();
            controller.enqueue(contents);
          } else if (e.message === 'timeout') {
            controller.enqueue('Timed out while loading file from the network')
          } else {
            console.error(e);
            controller.error(`Unexpected error: ${e.toString()}`);
          }
          controller.close();
        }
      }
    });
    return new Response(body, {
      headers: {
        "content-type": mime.getType(decodeURIComponent(pathname)) || 'text/html'
      }
    });
  }
}

export default DatHandler;
