const ApiHandler = require('./api-handler')

module.exports = class App {
  apiHandler: InstanceType<typeof ApiHandler>
  constructor() {
    this.apiHandler = new ApiHandler()
  }

  async run() {
    console.log("App is running!")
    this.apiHandler.configureApp()
    this.apiHandler.listen()
  }
}
