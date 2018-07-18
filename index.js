/*!
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

import {
  h,
  app
} from 'hyperapp';

import {
  Box,
  BoxStyled,
  Button,
  TextField,
  Toolbar,
  Menubar,
  MenubarItem
} from '@osjs/gui';

import PDFJS from 'pdfjs-dist';

const ZOOM_STEP = 0.2;

const pageLabel = (state) =>
  `${state.current} / ${state.total}`;

const zoomLabel = (state) => `${parseInt(state.zoom * 100, 10)}%`;

const view = (bus) => (state, actions) =>
  h(Box, {}, [
    h(Menubar, {}, [
      h(MenubarItem, {
        onclick: ev => bus.emit('menu', ev)
      }, 'File')
    ]),
    h(Toolbar, {}, [
      h(Button, {label: 'Zoom Out', onclick: () => bus.emit('set-state', state.current, state.zoom - ZOOM_STEP)}),
      h(Button, {label: 'Zoom In', onclick: () => bus.emit('set-state', state.current, state.zoom + ZOOM_STEP)}),
      h(TextField, {type: 'text', disabled: true, value: zoomLabel(state), box: {shrink: 1, grow: 1}}),
      h(Button, {label: 'Prev', onclick: () => bus.emit('set-state', state.current - 1, state.zoom)}),
      h(Button, {label: 'Next', onclick: () => bus.emit('set-state', state.current + 1, state.zoom)}),
      h(TextField, {type: 'text', disabled: true, value: pageLabel(state), box: {shrink: 1, grow: 1}}),
    ]),
    h(BoxStyled, {
      key: state.file,
      grow: 1,
      shrink: 1,
      class: 'osjs-pdfreader-container'
    }, [
      h('div', {
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'auto'
        }
      }, h('canvas', {}))
    ])
  ]);

const createApp = (core, proc, win, $content) => {
  let current;
  const bus = core.make('osjs/event-handler');

  const a = app({
    file: null,
    total: 0,
    current: 0,
    zoom: 1
  }, {
    setFile: ({file}) => state => ({file}),
    setState: newState => state => newState
  }, view(bus), $content);

  const openDocument = async (file) => {
    if (!file) {
      return;
    }

    win.setState('loading', true);

    try {
      const url = await core.make('osjs/vfs').url(file);
      current = await PDFJS.getDocument(url);

      a.setFile({file: url});
      win.setTitle(`${proc.metadata.title.en_EN} - ${file.filename}`);
      proc.args.file = file;

      bus.emit('opened');
    } catch (e) {
      core.make('osjs/dialog', 'alert', {
        parent: win,
        type: 'error',
        message: e
      });
      console.error(e);
    } finally {
      win.setState('loading', false);
    }
  };

  const openPage = async (index, zoom = 1) => {
    if (!current) {
      return;
    }

    const {numPages} = current;
    index = Math.max(1, Math.min(index, numPages));

    win.setState('loading', true);

    try {
      const page = await current.getPage(index);
      const canvas = win.$content.querySelector('canvas');
      const viewport = page.getViewport(zoom);
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      page.render({
        canvasContext: context,
        viewport
      });
    } catch (e) {
      console.error(e);
    } finally {
      win.setState('loading', false);
    }

    bus.emit('render', index, numPages, zoom);
  };

  win.on('render', () => openDocument(proc.args.file));
  win.on('destroy', () => {
    current = null;
    try {
      bus.destroy();
    }  catch (e) { /* noop */ }
  });

  bus.on('opened', () => openPage(1));
  bus.on('render', (current, total, zoom) => a.setState({current, total, zoom}));
  bus.on('set-state', (idx, zoom) => openPage(idx, zoom));
  bus.on('menu', (ev) => {
    core.make('osjs/contextmenu').show({
      menu: [
        {label: 'Open', onclick: () => {
          core.make('osjs/dialog', 'file', {type: 'open', mime: proc.metadata.mimes}, (btn, item) => {
            if (btn === 'ok') {
              openDocument(item);
            }
          });
        }},
        {label: 'Quit', onclick: () => proc.destroy()}
      ],
      position: ev.target
    });
  });
};

OSjs.make('osjs/packages').register('PDFReader', (core, args, options, metadata) => {
  const proc = core.make('osjs/application', {
    args,
    options,
    metadata
  });

  PDFJS.GlobalWorkerOptions.workerSrc = proc.resource('/pdf.worker.js');

  proc.createWindow({
    id: 'PDFReaderWindow',
    title: metadata.title.en_EN,
    icon: proc.resource(metadata.icon),
    dimension: {width: 400, height: 400}
  })
    .on('destroy', () => proc.destroy())
    .on('render', (win) => win.focus())
    .render(($content, win) => createApp(core, proc, win, $content));

  return proc;
});
