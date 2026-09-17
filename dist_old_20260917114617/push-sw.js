self.addEventListener('push', function (event) {
  var payload = { title: '衡动提醒', body: '有一项安排即将开始。', url: '/' }
  if (event.data) {
    try { payload = Object.assign(payload, event.data.json()) } catch (_) { payload.body = event.data.text() }
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: { url: payload.url || '/' },
    tag: payload.tag || 'fitness-reminder'
  }))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
    var target = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
    for (var i = 0; i < windows.length; i += 1) {
      if ('focus' in windows[i]) return windows[i].focus()
    }
    return clients.openWindow(target)
  }))
})
