export const isHandheldClient = () => {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent || window.navigator.vendor || ''
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTouchMac = /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1

  return isMobileUa || isTouchMac
}
