import { Types as OhifTypes } from '@ohif/core';
import { metaData, cache, StackViewport } from '@cornerstonejs/core';
import totalSegmentatorIntegration from './helpers/totalsegmentatorIntegration';

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
      title: 'TotalSegmentator integration',
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

  function checkConnection() {
    setTimeout(() => {
      _checkConnection();
    }, 500);
  }

  function _checkConnection() {
    if (!totalSegmentatorObject.isConnected()) {
      totalSegmentatorObject.openWebSocket();
    }
    setTimeout(() => {
      checkConnection();
    }, 3000);
  }

  function getToolGroup() {
    const { ohifViewport: activeViewport } = getActiveViewport();
    return toolGroupService.getToolGroupForViewport(activeViewport.viewportId);
  }

  const totalSegmentatorObject = new totalSegmentatorIntegration();

  const actions = {
    isConnected() {
      return totalSegmentatorObject.isConnected();
    },
    sendToProcess() {
      const { cornerstoneViewport: activeViewport } = getActiveViewport();
      const imageIds = getImageIds(activeViewport);
      console.log(imageIds[0]);
    },
  };

  const definitions = {
    isDeepLookConnected: {
      commandFn: actions.isConnected,
    },
    sendToProcess: {
      commandFn: actions.sendToProcess,
    },
  };

  return { actions, defaultContext, definitions };
};

export default commandsModule;
