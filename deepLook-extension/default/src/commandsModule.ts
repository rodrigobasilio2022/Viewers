import { Types as OhifTypes } from '@ohif/core';
import deepLookIntegration from './helpers/deepLookIntegration';
import { metaData, cache, StackViewport } from '@cornerstonejs/core';
import deepLookMouseBindings from './mouseBindings';

const defaultContext = 'CORNERSTONE';
const oldCalculation = true;

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

  function getOrientation(viewport) {
    const normalVector = viewport.getCamera().viewPlaneNormal;
    let largestAxis = 0;
    for (let i = 1; i < normalVector.length; i++) {
      if (Math.abs(normalVector[i]) > Math.abs(normalVector[largestAxis])) {
        largestAxis = i;
      }
    }
    return largestAxis;
  }

  function getPixelMM(xPos, yPos) {
    const { cornerstoneViewport: activeViewport } = getActiveViewport();
    if (oldCalculation) {
      const imageIds = getImageIds(activeViewport);
      if (imageIds && imageIds.length > 0) {
        const imagePlaneModule = metaData.get('imagePlaneModule', imageIds[0]);
        const zoom = activeViewport.getZoom();
        const pixelMMDicom = 1 / imagePlaneModule.pixelSpacing[0];
        const pixelMMScreen = pixelMMDicom / zoom;
        const pixelMM = Math.ceil(pixelMMScreen * 100000);
        console.log('PixelMM returned: ', pixelMMScreen);
        return {
          insideImageFrame: 1,
          pixelMM,
        };
      }
      return { insideImageFrame: 0, pixelMM: 0 };
    } else {
      const imageIds = getImageIds(activeViewport);
      let imagePlaneModule;
      if (imageIds && imageIds.length > 0) {
        imagePlaneModule = metaData.get('imagePlaneModule', imageIds[0]);
      }
      const worldPos = activeViewport.canvasToWorld([xPos, yPos]);
      const orientation = getOrientation(activeViewport);
      if (orientation === 0) {
        worldPos[1] = worldPos[1] + 1;
      } else {
        worldPos[0] = worldPos[0] + 1;
      }
      const canvasPos = activeViewport.worldToCanvas(worldPos);
      const pixelMM = Math.ceil(
        Math.max(Math.abs(canvasPos[0] - xPos), Math.abs(canvasPos[1] - yPos))
      );
      return {
        insideImageFrame: 1,
        pixelMM,
      };
    }
  }

  function checkDeepLookIsOpened() {
    if (!deepLookIntegrationObject.isConnected()) {
      setTimeout(() => {
        callDeepLookURL();
      }, 3000);
    }
  }

  function callDeepLookURL() {
    if (!deepLookIntegrationObject.isConnected()) {
      const deepLookURL = 'deeplook://open';
      const link = document.createElement('a');
      link.href = deepLookURL;
      link.click();
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
    openDeepLook() {
      checkDeepLookIsOpened();
    },
    isDeepLookConnected() {
      return deepLookIntegrationObject.isConnected();
    },
  };

  const definitions = {
    openDeepLook: {
      commandFn: actions.openDeepLook,
    },
    isDeepLookConnected: {
      commandFn: actions.isDeepLookConnected,
    },
  };
  checkDeepLookIsOpened();
  checkConnection();

  return { actions, defaultContext, definitions };
};

export default commandsModule;
