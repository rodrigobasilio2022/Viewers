class deepLookIntegration {
  serverIp;
  constructor(
    getPixelMM,
    activateMouseBindings,
    deactivateMouseBindings,
    connectionStatus,
    openCallback,
    errorCallback,
    closeCallback,
    ip = 'localhost'
  ) {
    this.serverIp = ip;
    this.getPixelMM = getPixelMM;
    this.bindedProcessMessages = this.processMessages.bind(this);
    this.activateMouseBindings = activateMouseBindings;
    this.deactivateMouseBindings = deactivateMouseBindings;
    this.connectionStatus = connectionStatus;
    this.safeCloseWebSocket = false;
    this.connectionOpened = false;
    this.openCallback = openCallback;
    this.errorCallback = errorCallback;
    this.closeCallback = closeCallback;
    this.webSocket = undefined;
  }

  getXML(elementTag, xml) {
    let startTag = '<' + elementTag + '>';
    let endTag = '</' + elementTag + '>';

    let elementStart = xml.indexOf(startTag) + startTag.length;
    let elementEnd = xml.indexOf(endTag);
    return xml.substring(elementStart, elementEnd);
  }

  processMessages(event) {
    let lesionMatchXML = event.data;

    let command = this.getXML('command', lesionMatchXML);
    let params;
    switch (command) {
      case 'xypixelpermm': {
        let xPos = this.getXML('xpos', lesionMatchXML);
        let yPos = this.getXML('ypos', lesionMatchXML);
        const { insideImageFrame, pixelMM } = this.getPixelMM(xPos, yPos);

        params = new Uint32Array(2);
        params[0] = insideImageFrame; // command - response -- 0 not found, 1 found result in param 1
        params[1] = pixelMM;
        break;
      }
      case 'massviewon': {
        params = new Uint32Array(1);
        params[0] = 1; // acknowledge got command
        console.log('MassView On\n');
        this.connectionStatus(true, 'MassView On');
        this.deactivateMouseBindings();

        break;
      }
      case 'massviewoff': {
        params = new Uint32Array(1);
        params[0] = 1; // acknowledge got command
        console.log('MassView Off\n');
        this.connectionStatus(true, 'MassView Off');
        this.activateMouseBindings();
        break;
      }
      default:
        break;
    }

    console.log('return int array');
    let i;
    for (i = 0; i < params.length; i++) {
      console.log(i + '  ' + params[i]);
    }

    this.webSocket.send(params);
  }

  processLog(isInfoMessage, message) {
    console.log(message);
    this.connectionStatus(isInfoMessage, message);
  }

  openWebSocket() {
    if (this.isConnected()) {
      return;
    }
    this.webSocket = new WebSocket('ws://' + this.serverIp + ':44458');
    if (!this.webSocket) {
      this.connectionStatus(false, 'Could not open a connection to DeepLook');
      return;
    }
    this.webSocket.addEventListener('error', event => {
      this.processLog(
        false,
        'DeepLook connection could not be established properly'
      );
      if (this.errorCallback) {
        this.errorCallback();
      }
    });

    this.webSocket.addEventListener('open', event => {
      this.processLog(true, 'DeepLook connection established successfully');
      this.connectionOpened = true;
      if (this.openCallback) {
        this.openCallback();
      }
    });

    this.webSocket.addEventListener('close', event => {
      if (!this.safeCloseWebSocket && this.connectionOpened) {
        this.processLog(false, 'DeepLook connection lost.');
      }
      this.safeCloseWebSocket = false;
      this.connectionOpened = false;
      if (this.closeCallback) {
        this.closeCallback();
      }
    });

    this.webSocket.addEventListener('message', event => {
      this.bindedProcessMessages(event);
    });
  }

  isConnected() {
    return this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
  }

  closeWebSocket() {
    if (this.isConnected()) {
      this.safeCloseWebSocket = true;
      this.webSocket.close();
      this.webSocket = undefined;
    }
  }
}

export default deepLookIntegration;
