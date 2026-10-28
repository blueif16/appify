// Shared between the studio core (studio.js) and the feature modules in
// ui/features/. The core fills in the state and functions; features import
// only this file, add their panels with addPanel and hook into frames.
//
//   studio.state            persisted settings; call studio.save() after changing
//   studio.frames           the open device windows (Frame objects)
//   studio.target           URL of the app being previewed
//   studio.proxyOrigin      origin the frames load the app from
//   studio.render()         rebuild every frame (e.g. after a setting that
//                           changes what the page is told)
//   studio.fit()            re-run the fit-to-screen layout
//   onFrame(fn)             fn(frame) after each frame is built
//   onConfig(fn)            fn(frame) returns extra fields for the config the
//                           page's frame script reads (window.__appify.cfg)
//   onMessage(fn)           fn(frame, msg) for each message from a page
//   addPanel(edge, el, order)  place a floating panel at 'left', 'right' or 'bottom'

export const studio = {
  state: null,
  frames: [],
  target: null,
  proxyOrigin: '',
  save: () => {},
  render: () => {},
  fit: () => {},
  hooks: { frame: [], config: [], message: [] },
  onFrame(fn) {
    this.hooks.frame.push(fn);
  },
  onConfig(fn) {
    this.hooks.config.push(fn);
  },
  onMessage(fn) {
    this.hooks.message.push(fn);
  },
  addPanel(edge, el, order = 0) {
    el.style.order = order;
    document.querySelector(`.edge-${edge}`).append(el);
  },
};
