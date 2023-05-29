import { Types as OhifTypes } from '@ohif/core';
import deepLookIntegration from './helpers/deepLookIntegration';
import { metaData, cache, StackViewport } from '@cornerstonejs/core';
import Length from '../../../extensions/cornerstone/src/utils/measurementServiceMappings/Length';
import UINotificationService from '../../../platform/core/src/services/UINotificationService/index';

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
      return {
        insideImageFrame: 1,
        pixelMM: Math.ceil(imagePlaneModule.pixelSpacing * 100),
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
    toolGroup.setToolDisabled('WindowLevel');
    return;
  }

  function activateMouseBindings() {
    commandsManager.runCommand('setToolActive', { toolName: 'WindowLevel' });
    return;
  }

  const deepLookIntegrationObject = new deepLookIntegration(
    getPixelMM.bind(viewportGridService, metaData, getImageIds),
    activateMouseBindings,
    deactivateMouseBindings,
    messageStatus
  );
  deepLookIntegrationObject.openWebSocket();
  const actions = {
    toggleMassView({ toggledState }) {
      if (toggledState) {
        deepLookIntegrationObject.openWebSocket();
      } else {
        deepLookIntegrationObject.closeWebSocket();
      }
    },
  };

  const definitions = {
    toggleMassView: {
      commandFn: actions.toggleMassView,
    },
  };

  return { actions, defaultContext, definitions };
};

export default commandsModule;
