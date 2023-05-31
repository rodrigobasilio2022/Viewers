import { Types as OhifTypes } from '@ohif/core';
import deepLookIntegration from './helpers/deepLookIntegration';
import { metaData, cache, StackViewport } from '@cornerstonejs/core';
import deepLookMouseBindings from './mouseBindings';

const defaultContext = 'CORNERSTONE';

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
      duration: 3000,
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
    const imageIds = getImageIds(activeViewport);
    if (imageIds && imageIds.length > 0) {
      const imagePlaneModule = metaData.get('imagePlaneModule', imageIds[0]);
      const pixelMM = Math.ceil(imagePlaneModule.pixelSpacing[0] * 100);
      return {
        insideImageFrame: 1,
        pixelMM,
      };
    }
    return { insideImageFrame: 0, pixelMM: 0 };
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
    getPixelMM.bind(viewportGridService, metaData, getImageIds),
    activateMouseBindings,
    deactivateMouseBindings,
    messageStatus
  );

  const actions = {
    openDeepLookConnection() {
      deepLookIntegrationObject.openWebSocket();
      return deepLookIntegrationObject.isConnected();
    },
    isDeepLookConnected() {
      return deepLookIntegrationObject.isConnected();
    },
    closeDeepLookConnection() {
      deepLookIntegrationObject.closeWebSocket();
    },
    showDeepLookMessage({ isInfoMessage, message }) {
      messageStatus(isInfoMessage, message);
    },
  };

  const definitions = {
    openDeepLookConnection: {
      commandFn: actions.openDeepLookConnection,
    },
    closeDeepLookConnection: {
      commandFn: actions.closeDeepLookConnection,
    },
    isDeepLookConnected: {
      commandFn: actions.isDeepLookConnected,
    },
    showDeepLookMessage: {
      commandFn: actions.showDeepLookMessage,
    },
  };

  return { actions, defaultContext, definitions };
};

export default commandsModule;
