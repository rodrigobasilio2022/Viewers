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

  /**
   * Gets the imageIds list based on the type of the viewport
   * @param baseViewport
   */
  function getImageIds(baseViewport) {
    let imageIds;
    if (baseViewport instanceof StackViewport) {
      imageIds = baseViewport.getImageIds();
    } else {
      const defaultActor = baseViewport.getDefaultActor();
      if (defaultActor) {
        const { uid: defaultActorUID } = defaultActor;
        const volume = cache.getVolume(defaultActorUID);
        imageIds = volume.imageIds;
      }
    }
    return imageIds;
  }

  function messageStatus(isInfoMessage, message) {
    uiNotificationService.show({
      title: 'DeepLook integration',
      message: message,
      type: isInfoMessage ? 'info' : 'error',
      duration: 2000,
    });
  }

  function getActiveViewport() {
    const { activeViewportIndex, viewports } = viewportGridService.getState();
    return {
      cornerstoneViewport: cornerstoneViewportService.getCornerstoneViewportByIndex(
        activeViewportIndex
      ),
      ohifViewport: viewports[activeViewportIndex],
    };
  }

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

  function checkDeepLookIsOpened() {
    if (!deepLookIntegrationObject.isConnected()) {
      deepLookIntegrationObject.openWebSocket();
      setTimeout(() => {
        callDeepLookURL();
      }, 3000);
    }
  }

  function callLink(deepLookURL) {
    const link = document.createElement('a');
    link.href = deepLookURL;
    link.click();
  }
  function callDeepLookURL() {
    if (!deepLookIntegrationObject.isConnected()) {
      openURL('deeplook://open', () => {
        if (!deepLookIntegrationObject.isConnected()) {
          window.open('https://emory.deeplook-medical.com/installer.html', '_blank');
        }
      });
    }
  }

  function checkConnection() {
    setTimeout(() => {
      _checkConnection();
    }, 500);
  }

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

  function openCallback() {
    return;
  }

  function errorCallback() {
    activateMouseBindings();
    return;
  }

  function closeCallback() {
    activateMouseBindings();
    return;
  }

  function getToolGroup() {
    const { ohifViewport: activeViewport } = getActiveViewport();
    return toolGroupService.getToolGroupForViewport(activeViewport.viewportId);
  }

  function deactivateMouseBindings() {
    const toolGroup = getToolGroup();
    lastToolNameDisabled = toolGroup.getActivePrimaryMouseButtonTool();
    if (lastToolNameDisabled) {
      toolGroup.setToolDisabled(lastToolNameDisabled);
    }
    return;
  }

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
  };

  const definitions = {
    isDeepLookConnected: {
      commandFn: actions.isDeepLookConnected,
    },
    closeDeepLookURL: {
      commandFn: actions.closeDeepLookURL,
    },
  };

  checkConnection();
  return { actions, defaultContext, definitions };
};

export default commandsModule;
