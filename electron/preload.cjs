'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const getInfo = () => ipcRenderer.invoke('liang:get-info');
const openPath = (targetPath) => ipcRenderer.invoke('liang:open-path', targetPath);
const openExternal = (url) => ipcRenderer.invoke('liang:open-external', url);
const chooseDirectory = () => ipcRenderer.invoke('liang:choose-directory');
const downloadToDirectory = (payload) => ipcRenderer.invoke('liang:download-to-directory', payload);

// window.liang is the historical compatibility API name used by the frontend.
// Keep it for now instead of window.huazai to avoid breaking existing calls.
contextBridge.exposeInMainWorld('liang', { getInfo, openPath, openExternal, chooseDirectory, downloadToDirectory });
