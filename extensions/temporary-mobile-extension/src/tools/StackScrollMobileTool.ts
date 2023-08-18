import {
  getEnabledElementByIds,
  VolumeViewport,
  StackViewport,
  utilities as csUtils,
} from '@cornerstonejs/core';
import {
  BaseTool,
  utilities as cstUtils,
  Types
} from '@cornerstonejs/tools';

/**
 * The StackScrollTool is a tool that allows the user to scroll through a
 * stack of images by pressing the mouse click and dragging
 */
class StackScrollMobileTool extends BaseTool {
  static toolName;
  deltaX: number;
  deltaY: number;
  mouseReleased: boolean;
  constructor(
    toolProps: Types.PublicToolProps = {},
    defaultToolProps: Types.ToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        lrChangeCallback: (deltaXOffset) => {},
        invert: false,
        debounceIfNotLoaded: true,
        loop: false,
      },
    }
  ) {
    super(toolProps, defaultToolProps);
    this.deltaX = 1;
    this.deltaY = 1;
    this.mouseReleased = true;
  }

  mouseDragCallback(evt: Types.EventTypes.InteractionEventType) {
    this._dragCallback(evt);
  }
  touchDragCallback(evt: Types.EventTypes.InteractionEventType) {
    this._dragCallback(evt);
  }

  touchEndCallback(evt: Types.EventTypes.InteractionEventType) {
    this.mouseReleased = true;
    this.deltaX = 1;
  }

  mouseUpCallback(evt: Types.EventTypes.InteractionEventType) {
    this.mouseReleased = true;
    this.deltaX = 1;
  }

  _dragCallback(evt: Types.EventTypes.InteractionEventType) {
    const { deltaPoints, viewportId, renderingEngineId } = evt.detail;
    const { viewport } = getEnabledElementByIds(viewportId, renderingEngineId);

    const targetId = this.getTargetId(viewport);
    const { debounceIfNotLoaded, invert, loop } = this.configuration;

    //alert('Delta Points: ' + deltaPoints.canvas);
    const deltaPointX = deltaPoints.canvas[0];
    const deltaPointY = deltaPoints.canvas[1];

    let volumeId;
    if (viewport instanceof VolumeViewport) {
      volumeId = targetId.split('volumeId:')[1];
    }

    const pixelsPerImage = this._getPixelPerImage(viewport);
    const deltaX = deltaPointX + this.deltaX;
    const deltaY = deltaPointY + this.deltaY;

    if (!pixelsPerImage) {
      return;
    }

    if (Math.abs(deltaY) >= pixelsPerImage) {
      const imageIdIndexOffset = Math.round(deltaY / pixelsPerImage);

      cstUtils.scroll(viewport, {
        delta: invert ? -imageIdIndexOffset : imageIdIndexOffset,
        volumeId,
        debounceLoading: debounceIfNotLoaded,
        loop: loop,
      });

      this.deltaY = deltaY % pixelsPerImage;
    } else {
      this.deltaY = deltaY;
    }

    if (this.mouseReleased) {
      if (Math.abs(deltaX) >= pixelsPerImage) {
        const deltaXOffset = Math.round(deltaX / pixelsPerImage);
        if (this.configuration.lrChangeCallback) {
          this.configuration.lrChangeCallback(deltaXOffset);
        }
        this.deltaX = deltaX % pixelsPerImage;
        this.mouseReleased = false;
      } else {
        this.deltaX = deltaX;
      }
    }
  }

  _getPixelPerImage(viewport) {
    const { element } = viewport;
    const numberOfSlices = this._getNumberOfSlices(viewport);

    // The Math.max here makes it easier to mouseDrag-scroll small or really large image stacks
    return Math.max(2, element.offsetHeight / Math.max(numberOfSlices, 8));
  }

  _getNumberOfSlices(viewport) {
    if (viewport instanceof VolumeViewport) {
      const { numberOfSlices } =
        csUtils.getImageSliceDataForVolumeViewport(viewport);
      return numberOfSlices;
    } else if (viewport instanceof StackViewport) {
      return viewport.getImageIds().length;
    }
  }
}

StackScrollMobileTool.toolName = 'StackScrollMobile';
export default StackScrollMobileTool;
