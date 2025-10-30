const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.getElementById('openSettings')!.addEventListener('click', () => {
  browserAPI.runtime.openOptionsPage();
  window.close();
});
