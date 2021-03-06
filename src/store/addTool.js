import store from './index.js';
import getToolForElement from './getToolForElement.js';

/**
 * Adds a tool to an enabled element.
 *
 * @public
 * @function addToolForElement
 * @memberof CornerstoneTools
 *
 * @param {HTMLElement} element The element to add the tool to.
 * @param {BaseTool} apiTool The tool to add to the element.
 * @param {Object} [configuration] Override the default tool configuration
 * @returns {undefined}
 */
const addToolForElement = function(element, apiTool, configuration) {
  // Instantiating the tool here makes it harder to accidentally add
  // The same tool (by reference) for multiple elements (which would reassign the tool
  // To a new element).
  const tool = new apiTool(configuration);
  const toolAlreadyAddedToElement = getToolForElement(element, tool.name);

  if (toolAlreadyAddedToElement) {
    console.warn(`${tool.name} has already been added to the target element`);

    return;
  }

  tool.element = element;
  store.state.tools.push(tool);
};

/**
 * Adds a tool to all enabled element.
 *
 * @public
 * @function addTool
 * @memberof CornerstoneTools
 *
 * @param {BaseTool} apiTool The tool to add to each element.
 * @param {Object} [configuration] Override the default tool configuration
 * @returns {undefined}
 */
const addTool = function(apiTool, configuration) {
  _addToolGlobally(apiTool, configuration);
  store.state.enabledElements.forEach(element => {
    addToolForElement(element, apiTool, configuration);
  });
};

/**
 * Adds tool with matching name from globally registered tools.
 * Requires `globalToolSyncEnabled` to be set to true
 *
 * @private
 * @function addToolGlobally
 *
 * @param {BaseTool} apiTool
 * @param {Object} [configuration] Override the default tool configuration
 * @returns {undefined}
 */
const _addToolGlobally = function(apiTool, configuration) {
  if (!store.modules.globalConfiguration.state.globalToolSyncEnabled) {
    return;
  }

  const tool = new apiTool(configuration);
  const toolAlreadyAddedGlobally =
    store.state.globalTools[tool.name] !== undefined;

  if (toolAlreadyAddedGlobally) {
    console.warn(`${tool.name} has already been added globally`);

    return;
  }

  store.state.globalTools[tool.name] = {
    tool: apiTool,
    configuration,
    activeBindings: [],
  };
};

export { addTool, addToolForElement };
