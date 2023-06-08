class totalSegmentatorIntegration {
  serverIp;
  constructor(ip = 'localhost') {
    this.serverIp = ip;
    this.bindedProcessMessages = this.processMessages.bind(this);
  }

  processMessages(event) {
    const message = JSON.parse(event.data);
    switch (message.type) {
      case 'information':
        // Update the UI with the move.
        console.log('Message received: ', message.payload);
        break;
      case 'file':
        console.log('Received a file: ');
        break;
      case 'error':
        console.log('Error occurred: ', message.payload);
        break;
      default:
        throw new Error(`Unsupported event type: ${message.type}.`);
    }
  }

  processLog(isInfoMessage, message) {
    console.log(message);
    this.connectionStatus(isInfoMessage, message);
  }

  openWebSocket() {
    this.webSocket = new WebSocket('ws://' + this.serverIp + ':9000');
    if (!this.webSocket) {
      this.connectionStatus(false, 'Could not open a connection to AI Server');
      return;
    }
    this.webSocket.addEventListener('error', event => {
      this.processLog(
        false,
        'AI Server connection could not be established properly'
      );
      if (this.errorCallback) {
        this.errorCallback();
      }
    });

    this.webSocket.addEventListener('open', event => {
      this.processLog(true, 'AI Server connection established successfully');
      this.connectionOpened = true;
      if (this.openCallback) {
        this.openCallback();
      }
    });

    this.webSocket.addEventListener('close', event => {
      if (!this.safeCloseWebSocket && this.connectionOpened) {
        this.processLog(false, 'AI Server connection lost.');
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

  sendRequest(dicomWebURL, dicomWebSufix, studyInstanceUID, seriesInstanceUID) {
    if (this.isConnected()) {
      const dicomWebInfo = {
        url: dicomWebURL,
        suffix: dicomWebSufix,
        studyUID: studyInstanceUID,
        seriesUID: seriesInstanceUID,
      };

      this.webSocket.send(JSON.stringify(dicomWebInfo));
    }
  }

  isConnected() {
    return this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
  }

  closeWebSocket() {
    if (this.isConnected()) {
      this.safeCloseWebSocket = true;
      this.webSocket.close();
    }
  }
}

export default totalSegmentatorIntegration;
