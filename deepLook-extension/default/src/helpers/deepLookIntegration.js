class deepLookIntegration {
  serverIp;
  constructor(
    getPixelMM,
    activateMouseBindings,
    deactivateMouseBindings,
    connectionStatus,
    ip = 'localhost'
  ) {
    this.serverIp = ip;
    this.getPixelMM = getPixelMM;
    this.bindedProcessMessages = this.processMessages.bind(this);
    this.activateMouseBindings = activateMouseBindings;
    this.deactivateMouseBindings = deactivateMouseBindings;
    this.connectionStatus = connectionStatus;
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

  openWebSocket() {
    this.webSocket = new WebSocket('ws://' + this.serverIp + ':44458');

    this.webSocket.addEventListener('error', event => {
      console.log('dlPrecise Socket open failed');
      this.connectionStatus(false, 'dlPrecise Socket open failed');
    });

    this.webSocket.addEventListener('open', event => {
      console.log('dlPrecise Socket open success');
      this.connectionStatus(true, 'dlPrecise Socket open success');
    });

    this.webSocket.addEventListener('close', event => {
      console.log('dlPrecise Socket close');
      this.connectionStatus(true, 'dlPrecise Socket close');
    });

    this.webSocket.addEventListener('message', event => {
      this.bindedProcessMessages(event);
    });
  }

  closeWebSocket() {
    if (this.webSocket && this.webSocket.readyState == WebSocket.OPEN) {
      this.webSocket.close();
    }
  }
}

export default deepLookIntegration;
