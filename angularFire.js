angular.module("firebase",[]).factory("angularFireCollection", ["$timeout",
  function($timeout) {
    return function(collectionRef, callbacks, initialCb) {
      if (typeof collectionRef == "string") {
        throw new Error("Please provide a Firebase reference instead " +
          "of a URL, eg: new Firebase(url)");
      }

      // An internal representation of a model present in the collection.
      var AngularFireItem = function(ref, index) {
        this.$ref = ref.ref();
        this.$id = ref.name();
        this.$index = index;
        angular.extend(this, {$priority: ref.getPriority()}, ref.val());
      };

      // Implementation of firebase priority ordering:
      // https://www.firebase.com/docs/javascript/firebase/setpriority.html
      var firebaseOrder = [
        // Partition into [ no priority, number as priority, string as priority ]
        function(item) {
          if (item.$priority == null) {
            return 0;
          } else if (angular.isNumber(item.$priority)) {
            return 1;
          } else if (angular.isString(item.$priority)) {
            return 2;
          }
        },
        // Within partions, sort first by priority (lexical or numerical,
        // no priority skips this level of sorting by returning Infinity)
        function(item) {
          return item.$priority ? item.$priority : Infinity;
        },
        // Finally, sort items of equal priority lexically by name
        function(item) {
          return item.$id;
        }
      ];

      var indexes = {};
      var collection = [];

      function getIndex(prevId) {
        return prevId ? indexes[prevId] + 1 : 0;
      }

      // Add an item to the local collection.
      function addChild(index, item) {
        indexes[item.$id] = index;
        collection.splice(index, 0, item);
        if(callbacks && callbacks.childAdded)
          callbacks.childAdded(item);
      }

      // Remove an item from the local collection.
      function removeChild(id) {
        var index = indexes[id];
        var item = collection.splice(index, 1);
        indexes[id] = undefined;
        if(callbacks && callbacks.childRemoved)
          callbacks.childRemoved(item);
      }

      // Update an existing child in the local collection.
      function updateChild(index, item) {
        collection[index] = item;
        if(callbacks && callbacks.childUpdated)
          callbacks.childUpdated(item);
      }

      // Move an existing child to a new location in the collection (usually
      // triggered by a priority change).
      function moveChild(from, to, item) {
        collection.splice(from, 1);
        collection.splice(to, 0, item);
        updateIndexes(from, to);
      }

      // Update the index table.
      function updateIndexes(from, to) {
        var length = collection.length;
        to = to || length;
        if (to > length) {
          to = length;
        }
        for (var index = from; index < to; index++) {
          var item = collection[index];
          item.$index = indexes[item.$id] = index;
        }
      }

      // Trigger the initial callback, if one was provided.
      if (initialCb && typeof initialCb == "function") {
        collectionRef.once("value", initialCb);
      }

      // Attach handlers for remote child added, removed, changed and moved
      // events.

      collectionRef.on("child_added", function(data, prevId) {
        $timeout(function() {
          var index = getIndex(prevId);
          addChild(index, new AngularFireItem(data, index));
          updateIndexes(index);
        });
      });

      collectionRef.on("child_removed", function(data) {
        $timeout(function() {
          var id = data.name();
          var pos = indexes[id];
          removeChild(id);
          updateIndexes(pos);
        });
      });

      collectionRef.on("child_changed", function(data, prevId) {
        $timeout(function() {
          var index = indexes[data.name()];
          var newIndex = getIndex(prevId);
          var item = new AngularFireItem(data, index);

          updateChild(index, item);
          if (newIndex !== index) {
            moveChild(index, newIndex, item);
          }
        });
      });

      collectionRef.on("child_moved", function(ref, prevId) {
        $timeout(function() {
          var oldIndex = indexes[ref.name()];
          var newIndex = getIndex(prevId);
          var item = collection[oldIndex];
          moveChild(oldIndex, newIndex, item);
        });
      });

      // `angularFireCollection` exposes four methods on the collection
      // returned.

      // Retrieve object by name.
      collection.getByName = function(name) {
        return collection[indexes[name]];
      };

      // Retrieve a collection of objects by names.
      collection.getByNames = function(names) {
        var objs = [];
        for (var i = 0, len = names.length; i < len; i++) {
          objs.push(collection[indexes[names[i]]]);
        }
        return objs;
      };

      // Add an object to the remote collection. Adding an object is the
      // equivalent of calling `push()` on a Firebase reference.
      collection.add = function(item, cb) {
        var ref;
        // Make sure to remove $$hashKey etc.
        var newItem = angular.fromJson(angular.toJson(item));
        if (!cb) {
          ref = collectionRef.ref().push(newItem);
        } else {
          ref = collectionRef.ref().push(newItem, cb);
        }
        return ref;
      };

      // Remove an object from the remote collection.
      collection.remove = function(itemOrId, cb) {
        var item = angular.isString(itemOrId) ?
          collection[indexes[itemOrId]] : itemOrId;
        if (!cb) {
          item.$ref.remove();
        } else {
          item.$ref.remove(cb);
        }
      };

      // Incrementally update an object in the remote collection.
      collection.update = function(itemOrId, cb) {
        var item = angular.isString(itemOrId) ?
          collection[indexes[itemOrId]] : itemOrId;
        var copy = angular.fromJson(angular.toJson(item));
        if (!cb) {
          item.$ref.update(copy);
        } else {
          item.$ref.update(copy, cb);
        }
      };

      // Update an object in its entirety in the remote collection.
      collection.set = function(itemOrId, cb) {
        var item = angular.isString(itemOrId) ?
          collection[indexes[itemOrId]] : itemOrId;
        var copy = angular.fromJson(angular.toJson(item));
        if (!cb) {
          item.$ref.set(copy);
        } else {
          item.$ref.set(copy, cb);
        }
      };

      collection.order = firebaseOrder;
      return collection;
    };
  }
]);