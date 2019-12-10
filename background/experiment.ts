import createDatArchive from "@sammacbeth/dat-archive";
import { DatAPI } from "./dat";
import { IHyperdrive } from "@sammacbeth/dat-types/lib/hyperdrive";

const publicTestDat = "ee172d7cd9235b2cf86ea9481e8a40e48cea29c743036621edc79a4765aa0281";    

function sendAnolysisMessage(message, schema) {
  browser.runtime.sendMessage('cliqz@cliqz.com', {
    moduleName: 'core',
    action: 'sendTelemetry',
    args: [message, false, schema],
  })
}

export default class PerformanceExperiment {
  constructor(protected node: DatAPI) {}

  start() {
    // setup timer to start on next hour
    const alarmName = "experiment timer";
    const when = new Date();
    when.setMinutes(0);
    when.setSeconds(0);
    when.setHours(when.getHours() + 1);
    browser.alarms.create(alarmName, {
      when: when.valueOf(),
      periodInMinutes: 60,
    });
    browser.alarms.onAlarm.addListener(async alarm => {
      if (alarm.name === alarmName) {
        const t = new Date();
        const [day, hour] = [t.getDate(), t.getHours()];
        const { perfLastDay } = await browser.storage.local.get(['perfLastDay']);
        if (!perfLastDay || day !== perfLastDay) {
          this.run().then((result: any) => {
            result.hour = hour;
            result.version = browser.runtime.getManifest().version;
            console.log('self-test results', result);
            sendAnolysisMessage(result, 'metrics.dat.performance');
            browser.storage.local.set({
              perfLastDay: day,
            });
          });
        }
      }
    });
  }

  async run() {
    // idle performance
    const {
      duration,
      memory: idleMemory,
      totalDispatches
    } = await this.probePerformance();
    // wait 30s
    await new Promise((resolve) => setTimeout(resolve, 30000));
    // check dispatches during the 30s idle wait
    const { totalDispatches: dispatchesAfterIdle } = await this.probePerformance();
    
    // test loading a dat
    const result: any = await this.runDatTest(publicTestDat, true, 30000);
    const { memory: activeMemory, totalDispatches: activeDispatches } = await this.probePerformance();

    return {
      duration,
      idleMemory,
      idleDispatches: dispatchesAfterIdle - totalDispatches,
      activeMemory,
      activeDispatches: activeDispatches - dispatchesAfterIdle,
      tLoaded: result.loaded,
      tReady: result.ready,
      tInfo: result.info,
      loadedVersion: result.version,
      finalVersion: result.finalVersion,
      initialPeers: result.initialPeers,
      finalPeers: result.finalPeers,
    }
  }

  async runDatTest(address: string, persist: boolean, timeout: number) {
    let result: any = {};
    (async () => {
      const resultIt = this.datTest(address, persist);
      for await (const info of resultIt) {
        Object.assign(result, info);
      }
      Promise.resolve({});
    })();
    return new Promise((resolve) => {
      setTimeout(async () => {
        if (result.archive) {
          try {
            result.finalPeers = (await result.archive.getInfo()).peers;
          } catch (e) {}
        }
        if (result.dat) {
          const drive: IHyperdrive = result.dat.drive;
          result.finalVersion = drive.version;
        }
        
        resolve(result);
      }, timeout);
    });
  }

  async *datTest(address: string, persist: boolean) {
    const start = Date.now();
    const dat = await this.node.getDat(address, {
      persist,
      sparse: true,
    });
    yield {
      loaded: Date.now() - start,
      dat,
    };
    await dat.ready;
    yield {
      ready: Date.now() - start,
      version: dat.drive.version
    };
    const archive = createDatArchive(dat.drive);
    const { peers } = await archive.getInfo();
    yield {
      info: Date.now() - start,
      initialPeers: peers,
      archive,
    };
    return;
  }

  async probePerformance() {
    const extensionHost = new URL(browser.runtime.getURL("")).hostname;
    const metrics = await browser.performance.requestPerformanceMetrics();
    const extensionMetrics = metrics.find(m => m.host === extensionHost);
    if (extensionMetrics) {
      return {
        duration: extensionMetrics.duration,
        memory: extensionMetrics.memoryInfo.GCHeapUsage,
        totalDispatches: extensionMetrics.items.reduce((acc, val) => {
          return acc + val.count;
        }, 0)
      };
    }
    return {
      duration: 0,
      memory: 0,
      totalDispatches: 0
    };
  }
}
