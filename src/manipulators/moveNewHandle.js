import EVENTS from '../events.js';
import external from '../externalModules.js';
import anyHandlesOutsideImage from './anyHandlesOutsideImage.js';
import { removeToolState } from '../stateManagement/toolState.js';
import triggerEvent from '../util/triggerEvent.js';
import { clipToBox } from '../util/clip.js';
import { state } from './../store/index.js';

const _moveEvents = {
  mouse: [EVENTS.MOUSE_MOVE, EVENTS.MOUSE_DRAG],
  touch: [EVENTS.TOUCH_DRAG],
};

const _moveEndEvents = {
  mouse: [EVENTS.MOUSE_UP, EVENTS.MOUSE_CLICK],
  touch: [EVENTS.TOUCH_END, EVENTS.TOUCH_PINCH, EVENTS.TAP],
};

/**
 * Move a new handle
 * @public
 * @method moveNewHandle
 * @memberof Manipulators
 *
 * @param {*} evtDetail
 * @param {*} toolName
 * @param {*} toolData
 * @param {*} handle
 * @param {*} [options={}]
 * @param {Boolean}  [options.deleteIfHandleOutsideImage]
 * @param {function} [options.doneMovingCallback]
 * @param {Boolean}  [options.preventHandleOutsideImage]
 * @param {*} [interactionType=mouse]
 * @returns {undefined}
 */
export default function(
  evtDetail,
  toolName,
  toolData,
  handle,
  options,
  interactionType = 'mouse'
) {
  // Use global defaults, unless overidden by provided options
  options = Object.assign(
    {
      deleteIfHandleOutsideImage: state.deleteIfHandleOutsideImage,
      preventHandleOutsideImage: state.preventHandleOutsideImage,
    },
    options
  );

  const element = evtDetail.element;

  state.isToolLocked = true;
  handle.active = true;
  toolData.active = true;

  // I'm not sure we need either of these.
  // The other manipulators don't handle for these edge cases?
  // Const toolDeactivatedHandler = _toolDeactivatedHandler.bind(
  //   This,
  //   ToolName,
  //   MoveEndHandler
  // );
  // Const measurementRemovedHandler = _measurementRemovedHandler.bind(
  //   This,
  //   ToolData,
  //   MoveEndHandler
  // );
  const moveHandler = _moveHandler.bind(
    this,
    toolName,
    toolData,
    handle,
    options,
    interactionType
  );
  // So we don't need to inline the entire `moveEndEventHandler` function
  const moveEndHandler = evt => {
    _moveEndHandler(
      toolName,
      toolData,
      handle,
      options,
      interactionType,
      {
        moveHandler,
        moveEndHandler,
      },
      evt
    );
  };

  // Add event listeners
  _moveEvents[interactionType].forEach(eventType => {
    element.addEventListener(eventType, moveHandler);
  });
  _moveEndEvents[interactionType].forEach(eventType => {
    element.addEventListener(eventType, moveEndHandler);
  });
  // Element.addEventListener(
  //   EVENTS.MEASUREMENT_REMOVED,
  //   MeasurementRemovedHandler
  // );
  // Element.addEventListener(EVENTS.TOOL_DEACTIVATED, toolDeactivatedHandler);
  element.addEventListener(EVENTS.TOUCH_START, _stopImmediatePropagation);
}

function _moveHandler(
  toolName,
  toolData,
  handle,
  options,
  interactionType,
  evt
) {
  const { currentPoints, image, element } = evt.detail;
  const page = currentPoints.page;
  const fingerOffset = -57;
  const targetLocation = external.cornerstone.pageToPixel(
    element,
    interactionType === 'touch' ? page.x + fingerOffset : page.x,
    interactionType === 'touch' ? page.y + fingerOffset : page.y
  );

  handle.active = true;
  handle.x = targetLocation.x;
  handle.y = targetLocation.y;

  if (options && options.preventHandleOutsideImage) {
    clipToBox(handle, image);
  }

  external.cornerstone.updateImage(element);

  const eventType = EVENTS.MEASUREMENT_MODIFIED;
  const modifiedEventData = {
    toolName,
    element,
    measurementData: toolData,
  };

  triggerEvent(element, eventType, modifiedEventData);
}

function _moveEndHandler(
  toolName,
  annotation,
  handle,
  options,
  interactionType,
  { moveHandler, moveEndHandler },
  evt
) {
  const { element, currentPoints } = evt.detail;
  const page = currentPoints.page;
  const fingerOffset = -57;
  const targetLocation = external.cornerstone.pageToPixel(
    element,
    interactionType === 'touch' ? page.x + fingerOffset : page.x,
    interactionType === 'touch' ? page.y + fingerOffset : page.y
  );

  // "Release" the handle
  handle.active = false;
  annotation.active = false;
  state.isToolLocked = false;
  handle.x = targetLocation.x;
  handle.y = targetLocation.y;

  // Remove event listeners
  _moveEvents[interactionType].forEach(eventType => {
    element.removeEventListener(eventType, moveHandler);
  });
  _moveEndEvents[interactionType].forEach(eventType => {
    element.removeEventListener(eventType, moveEndHandler);
  });
  // Element.removeEventListener(
  //   EVENTS.MEASUREMENT_REMOVED,
  //   MeasurementRemovedHandler
  // );
  // Element.removeEventListener(EVENTS.TOOL_DEACTIVATED, toolDeactivatedHandler);
  element.removeEventListener(EVENTS.TOUCH_START, _stopImmediatePropagation);

  // TODO: WHY?
  // Why would a Touch_Pinch or Touch_Press be associated with a new handle?
  if (evt.type === EVENTS.TOUCH_PINCH || evt.type === EVENTS.TOUCH_PRESS) {
    handle.active = false;
    external.cornerstone.updateImage(element);
    if (typeof options.doneMovingCallback === 'function') {
      options.doneMovingCallback();
    }

    return;
  }

  if (options.preventHandleOutsideImage) {
    clipToBox(handle, evt.detail.image);
  }

  // If any handle is outside the image, delete the tool data
  if (
    options.deleteIfHandleOutsideImage &&
    anyHandlesOutsideImage(evt.detail, annotation.handles)
  ) {
    removeToolState(element, toolName, annotation);
  }

  if (typeof options.doneMovingCallback === 'function') {
    options.doneMovingCallback();
  }

  // Update Image
  external.cornerstone.updateImage(element);
}

/**
 * If our measurement was removed, we want to end "handling" it's data.
 *
 * @private
 * @function _measurementRemovedHandler
 *
 * @param {*} toolData
 * @param {*} moveEndHandler
 * @param {*} evt
 * @returns {undefined}
 */
// Function _measurementRemovedHandler(toolData, moveEndHandler, evt) {
//   If (evt.detail.measurementData === toolData) {
//     MoveEndHandler(evt);
//   }
// }

/**
 * If the tool is deactivated while we're moving it's handle,
 * we'll want to stop moving it and kill events.
 *
 * @private
 * @function _toolDeactivatedHandler
 *
 * @param {string} toolName
 * @param {*} moveEndHandler
 * @param {*} evt
 * @returns {undefined}
 */
// Function _toolDeactivatedHandler(toolName, moveEndHandler, evt) {
//   If (evt.detail.toolType === toolName) {
//     MoveEndHandler(evt);
//   }
// }

/**
 * Stop the CornerstoneToolsTouchStart event from
 * Becoming a CornerstoneToolsTouchStartActive event when
 * MoveNewHandle ends
 *
 * @private
 * @function _stopImmediatePropagation
 *
 * @param {*} evt
 * @returns {Boolean} false
 */
function _stopImmediatePropagation(evt) {
  evt.stopImmediatePropagation();

  return false;
}
