
this.performance = class extends ExtensionAPI {
  getAPI(context) {
    return {
      performance: {
        requestPerformanceMetrics: () => {
          return ChromeUtils.requestPerformanceMetrics();
        }
      }
    }
  }
};
