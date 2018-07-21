var from = require('from2-array')
var concat = require('concat-stream')
var test = require('tape')
var Store = require('../')
var tmp = require('tempy')
var rimraf = require('rimraf')

var common = {
  setup: function (t, cb) {
    var dir = tmp.directory()
    var store = Store(dir)
    cb(null, store)
  },
  teardown: function (t, store, blob, cb) {
    rimraf.sync(store._dir)
    cb()
  }
}

var abstractBlobTests = require('abstract-blob-store/tests')
abstractBlobTests(test, common)

test('piping a blob into a blob write stream', function (t) {
  common.setup(test, function (err, store) {
    t.notOk(err, 'no setup err')
    var ws = store.createWriteStream({name: 'deep/subdir/long-filename-test.js'}, function (err, obj) {
      t.error(err)
      t.ok(obj.key, 'blob has key')
      common.teardown(test, store, obj, function (err) {
        t.error(err)
        t.end()
      })
    })
    from([Buffer.from('foo'), Buffer.from('bar')]).pipe(ws)
  })
})

test('reading a blob as a stream', function (t) {
  common.setup(test, function (err, store) {
    t.notOk(err, 'no setup err')

    var ws = store.createWriteStream({name: 'deep/subdir/long-filename-test.js'}, function (err, blob) {
      t.notOk(err, 'no blob write err')
      t.ok(blob.key, 'blob has key')

      var rs = store.createReadStream(blob)

      rs.on('error', function (e) {
        t.false(e, 'no read stream err')
        t.end()
      })

      rs.pipe(concat(function (file) {
        t.equal(file.length, 6, 'blob length is correct')
        common.teardown(test, store, blob, function (err) {
          t.error(err)
          t.end()
        })
      }))
    })

    from([Buffer.from('foo'), Buffer.from('bar')]).pipe(ws)
  })
})

test('reading a blob that does not exist', function (t) {
  common.setup(test, function (err, store) {
    t.notOk(err, 'no setup err')

    var rs = store.createReadStream({name: 'deep/subdir/long-filename-test.js', key: '8843d7f92416211de9ebb963ff4ce28125932878'})

    rs.on('error', function (e) {
      t.ok(e, 'got a read stream err')
      t.ok(e.notFound, 'error reports not found')
      common.teardown(test, store, undefined, function (err) {
        t.error(err)
        t.end()
      })
    })
  })
})

test('check if a blob exists', function (t) {
  common.setup(test, function (err, store) {
    t.notOk(err, 'no setup err')
    var blobMeta = {name: 'deep/subdir/long-filename-test.js', key: '8843d7f92416211de9ebb963ff4ce28125932878'}
    store.exists(blobMeta, function (err, exists) {
      t.error(err)
      t.notOk(exists, 'does not exist')

      var ws = store.createWriteStream({name: 'deep/subdir/long-filename-test.js'}, function (err, obj) {
        t.notOk(err, 'no blob write err')
        t.ok(obj.key, 'blob has key')

        // on this .exists call use the metadata from the writeStream
        store.exists(obj, function (err, exists) {
          t.error(err)
          t.ok(exists, 'exists')
          common.teardown(test, store, obj, function (err) {
            t.error(err)
            t.end()
          })
        })
      })

      from([Buffer.from('foo'), Buffer.from('bar')]).pipe(ws)
    })
  })
})

test('_list lists keys', function (t) {
  common.setup(test, function (err, store) {
    t.notOk(err, 'no setup err')
    var filenames = ['hello.txt', 'deep/subdir/long-filename-test.js', 'subdir/filename.txt']
    var pending = filenames.length
    filenames.forEach(function (name) {
      var ws = store.createWriteStream({name: name}, onWrite)
      from([Buffer.from('foo'), Buffer.from('bar')]).pipe(ws)
    })

    function onWrite (err, obj) {
      t.error(err)
      t.ok(obj.key, 'blob has key')
      if (--pending > 0) return
      store._list(onList)
    }

    function onList (err, keys) {
      t.error(err)
      t.deepEqual(filenames.sort(), keys.sort(), 'keys in list are correct')
      common.teardown(test, store, null, function (err) {
        t.error(err)
        t.end()
      })
    }
  })
})
