"use strict";

let {OutputAreaModel, OutputAreaWidget, OutputType} = require('jupyter-js-output-area');

class Sidecar {
  constructor(container, document) {
    this.document = document;
    this.container = container;

    // parentID -> OutputArea
    this.areas = new Map();
  }

  consume(message) {
    console.log(message);
    if (! message.parent_header && ! message.parent_header.msg_id) {
      return;
    }

    let parentID = message.parent_header.msg_id;
    let area = this.areas[parentID];

    if(!area) {
      // Create it
      area = new OutputArea(this.document);
      area.node.id = parentID; // For later bookkeeping
      this.container.appendChild(area.node);

      // Keep a running tally of output areas
      this.areas[parentID] = area;
    }

    let consumed = area.consume(message);
    if (consumed) {
      area.node.scrollIntoView();
    }
    console.log('consumed: '+consumed);
    return consumed;
  }
}

class OutputArea {
  constructor(document) {
    this.model = new OutputAreaModel();
    this.view = new OutputAreaWidget(this.model, document);

    this.node = this.view.node;
    this.node.className = 'output-area';
  }

  consume(msg) {
    let output = {};
    let {content} = msg;
    console.log('msg_type: '+msg.header.msg_type);
    switch (msg.header.msg_type) {
    case 'clear_output':
      this.model.clear(content.wait)
      break;
    case 'stream':
      output.outputType = OutputType.Stream;
      output.text = content.text;
      switch(content.name) {
      case "stderr":
        output.name = StreamName.StdErr;
        break;
      case "stdout":
        output.name = StreamName.StdOut;
        break;
      default:
        throw new Error(`Unrecognized stream type ${content.name}`);
      }
      this.model.add(output);
      break;
    case 'display_data':
      output.outputType = OutputType.DisplayData;
      output.data = content.data;
      output.metadata = content.metadata;
      this.model.add(output);
      break;
    case 'execute_result':
      output.outputType = OutputType.ExecuteResult;
      output.data = content.data;
      output.metadata = content.metadata;
      output.execution_count = content.execution_count;
      this.model.add(output);
      break;
    case 'error':
      output.outputType = OutputType.Error;
      output.ename = content.ename;
      output.evalue = content.evalue;
      output.traceback = content.traceback.join('\n');
      this.model.add(output);
      break;
    default:
      console.error('Unhandled message', msg);
    }
    // return this.view.processMessage(msg);
    return msg;
  }
}

module.exports = Sidecar;
