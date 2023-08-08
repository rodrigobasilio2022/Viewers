import deepLookIntegration from './helpers/deepLookIntegration';
import deepLookMouseBindings from './mouseBindings';
import openURL from './helpers/openURL';

const { metaData, cache, StackViewport } = window.sharedLibraries['@cornerstonejs/core'];
const { Types : OhifTypes } = window.sharedLibraries['@ohif/core'];
const { vec3 } = window.sharedLibraries['gl-matrix'];

const defaultContext = 'CORNERSTONE';
const numberOfTries = 3;
const commandsModule = ({
  servicesManager,
  commandsManager,
  extensionManager,
  appConfig,
}: OhifTypes.Extensions.ExtensionParams): OhifTypes.Extensions.CommandsModule => {
  const {
    viewportGridService,
    toolGroupService,
    cornerstoneViewportService,
    uiNotificationService,
  } = servicesManager.services;
  let lastToolNameDisabled;
  let nTries = numberOfTries;
  let heartBeatPulseId;

  /**
   * This function presents a notification message related to DeepLook integration
   * in the screen, that could be an error message or an info message
   * @param isInfoMessage true : info message, false : error message
   * @param message message to be displayed
   */
  function messageStatus(isInfoMessage, message) {
    uiNotificationService.show({
      title: 'DeepLook integration',
      message: message,
      type: isInfoMessage ? 'info' : 'error',
      duration: 2000,
    });
  }

  /**
   * This function gets the current OHIF active viewport
   * @returns
   */
  function getActiveViewport() {
    const { activeViewportIndex, viewports } = viewportGridService.getState();
    return {
      cornerstoneViewport: cornerstoneViewportService.getCornerstoneViewportByIndex(
        activeViewportIndex
      ),
      ohifViewport: viewports[activeViewportIndex],
    };
  }

  /**
   * This function calculates the pixel to millimeter ratio. It uses the canvasToWorld
   * function to calculate the distance in millimeters of 100 pixels and uses this value
   * to calculate the ratio
   * @param xPos
   * @param yPos
   * @returns
   */
  function getPixelMM(xPos, yPos) {
    const { cornerstoneViewport: activeViewport } = getActiveViewport();
    const worldPos1 = activeViewport.canvasToWorld([0, 100]);
    const worldPos2 = activeViewport.canvasToWorld([0, 200]);
    const distance = vec3.distance(worldPos1, worldPos2);
    const pixelMM = Math.ceil((1 / distance) * 100000);
    console.log('PixelMM returned: ', pixelMM, ' Distance: ', distance);
    return {
      insideImageFrame: 1,
      pixelMM,
    };
  }

  /**
   * This function just call an url without error callback function. Could be
   * deleted in next versions of this software
   * @param deepLookURL url to be opened
   */
  function callLink(deepLookURL) {
    const link = document.createElement('a');
    link.href = deepLookURL;
    link.click();
  }

  /**
   * This function calls a custom URL protocol link that if correctly installed, it will
   * start DLPrecise. To open this link, it uses the openURL function that receives to parameters:
   *  - the url protocol to be opened
   *  - a function to be called if the url call failed. In this case it opens in a new window
   *    a web page with instructions to download a file that will install the DLPrecise in the user computer
   */
  function callDeepLookURL() {
    if (!deepLookIntegrationObject.isConnected()) {
      openURL('deeplook://open', () => {
        if (!deepLookIntegrationObject.isConnected()) {
          window.open('https://emory.deeplook-medical.com/installer.html', '_blank');
        }
      });
    }
  }

  // This pair of functions monitors, from time to time, the connection with DLPrecise
  // If down, after a predefined number of tries, it tries to reestablish the connection by
  // starting DLPrecise with a custom URL protocol scheme described

  /**
   * This function starts the loop to check DLPrecise connection. It just calls the _checkConnection
   * to wait for the websocket connection be established
   */
  function checkConnection() {
    setTimeout(() => {
      _checkConnection();
    }, 500);
  }

  /**
   * This function checks if the connection is established. If not try to connect. After
   * enough tries (3 default), if call the function callDeepLookURL to start DLPrecise
   */
  function _checkConnection() {
    if (!deepLookIntegrationObject.isConnected()) {
      deepLookIntegrationObject.openWebSocket();
      if (nTries === 0) {
        callDeepLookURL();
        nTries = numberOfTries;
      } else {
        nTries -= 1;
      }
    } else {
      nTries = numberOfTries;
    }
    setTimeout(() => {
      checkConnection();
    }, 3000);
  }

  /**
   * This callback function is called when a connection is established with DLPrecise
   * @returns
   */
  function openCallback() {
    return;
  }

  /**
   * This callback function is called when a connection with DLPrecise fails
   * It reactivate the mouse bindings
   * @returns
   */
  function errorCallback() {
    activateMouseBindings();
    return;
  }

  /**
   * This callback function is called when a connection with DLPrecise is closed
   * It reactivate the mouse bindings
   * @returns
   */
  function closeCallback() {
    activateMouseBindings();
    return;
  }

  function getToolGroup() {
    const { ohifViewport: activeViewport } = getActiveViewport();
    return toolGroupService.getToolGroupForViewport(activeViewport.viewportId);
  }

  /**
   * This function deactivates the mouse bindings so DLPrecise can control the mouse
   * without any image manipulation
   * @returns
   */
  function deactivateMouseBindings() {
    const toolGroup = getToolGroup();
    lastToolNameDisabled = toolGroup.getActivePrimaryMouseButtonTool();
    if (lastToolNameDisabled) {
      toolGroup.setToolDisabled(lastToolNameDisabled);
    }
    return;
  }

  /**
   * This function sends an heart beat pulse every 30 secs
   */
  function sendHeatBeatPulse() {
    heartBeatPulseId = setInterval(() => {
      deepLookIntegrationObject.heartBeat();
    }, 30000);
  }

  /**
   * This function reactivates the mouse bindings after DLPrecise releases control
   * @returns
   */
  function activateMouseBindings() {
    if (lastToolNameDisabled) {
      commandsManager.runCommand('setToolActive', {
        toolName: lastToolNameDisabled,
      });

      const mouseBinding = deepLookMouseBindings(lastToolNameDisabled);
      if (mouseBinding) {
        const toolGroup = getToolGroup();
        toolGroup.setToolActive(lastToolNameDisabled, {
          bindings: [
            {
              mouseButton: mouseBinding,
            },
          ],
        });
      }
      lastToolNameDisabled = undefined;
    }
    return;
  }

  const deepLookIntegrationObject = new deepLookIntegration(
    getPixelMM,
    activateMouseBindings,
    deactivateMouseBindings,
    messageStatus,
    openCallback,
    errorCallback,
    closeCallback
  );

  const actions = {
    isDeepLookConnected() {
      return deepLookIntegrationObject.isConnected();
    },
    closeDeepLookURL() {
      callLink('deeplook://close');
    },
    resetDeepLook() {
      deepLookIntegrationObject.resetDLPrecise();
    },
  };

  const definitions = {
    isDeepLookConnected: {
      commandFn: actions.isDeepLookConnected,
    },
    closeDeepLookURL: {
      commandFn: actions.closeDeepLookURL,
    },
    resetDeepLook: {
      commandFn: actions.resetDeepLook,
    },
  };

  // When OHIF is closed, call closeDLPrecise command
  window.addEventListener('unload', event => {
    console.log('Closing DLPrecise and stopping heartbeat pulse');
    deepLookIntegrationObject.closeDLPrecise();
    clearInterval(heartBeatPulseId);
  });
  checkConnection();
  sendHeatBeatPulse();
  return { actions, defaultContext, definitions };
};

export default commandsModule;
