// A stand-in for @zos/ui, so page/index.js can be driven by a test instead of by
// a wrist. Widgets are plain objects that remember the properties they were given
// and the listeners hung off them; the test reads the screen back out of
// `widgets` and fires touches into the listeners by hand.
export const widget = {
  FILL_RECT: "FILL_RECT",
  TEXT: "TEXT",
  BUTTON: "BUTTON",
};

export const prop = {
  MORE: "MORE",
  X: "X",
  Y: "Y",
  W: "W",
  H: "H",
  TEXT: "TEXT",
  VISIBLE: "VISIBLE",
};

export const align = { CENTER_H: "CENTER_H", CENTER_V: "CENTER_V" };
export const text_style = { NONE: "NONE" };

export const event = {
  CLICK_DOWN: "CLICK_DOWN",
  CLICK_UP: "CLICK_UP",
  MOVE: "MOVE",
  MOVE_IN: "MOVE_IN",
  MOVE_OUT: "MOVE_OUT",
};

// Every widget currently on screen, in the order it was created - which is also
// the order the real device stacks them in, so a test can check what is on top.
export const widgets = [];

export function createWidget(type, props) {
  const created = {
    type,
    props: Object.assign({}, props),
    listeners: {},

    addEventListener(id, callback) {
      if (!this.listeners[id]) {
        this.listeners[id] = [];
      }
      this.listeners[id].push(callback);
    },

    removeEventListener(id) {
      delete this.listeners[id];
    },

    setProperty(name, value) {
      if (name === prop.MORE) {
        Object.assign(this.props, value);
        return;
      }
      this.props[name] = value;
    },

    getProperty(name) {
      return this.props[name];
    },

    // Deliver one touch event to this widget, as the firmware would.
    fire(id, info) {
      const callbacks = this.listeners[id] || [];
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](info);
      }
    },
  };
  widgets.push(created);
  return created;
}

export function deleteWidget(target) {
  const index = widgets.indexOf(target);
  if (index !== -1) {
    widgets.splice(index, 1);
  }
}
