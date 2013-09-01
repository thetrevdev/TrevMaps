var app = angular.module('plunker', ['firebase', 'ui.map', 'ngCookies']);

app.controller('MainCtrl', function ($scope, angularFireCollection, $cookies, $q) {

    $scope.myMarkerId = $cookies.myMarkerId;

    $scope.name = 'Guest';

    $scope.myMarkers = [];
    $scope.markerIndex = {};

    $scope.mapOptions = {
        center: new google.maps.LatLng(33.684, -117.795),
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    var callBacks = getCallbackFn();

    var locationPromise = $q.defer();
    var firebasePromise = $q.defer();
    var initPromise = $q.all([locationPromise.promise, firebasePromise.promise]);

    initPromise.then(initMe);


    navigator.geolocation.watchPosition(positionUpdated);

    $scope.items = angularFireCollection(new Firebase('https://trevdev-gmaps.firebaseio.com/list'), callBacks, cb);


    function initMe() {
        //look for fbItem
        var myMarkerId = $cookies.myMarkerId;
        var myItem;
        angular.forEach($scope.items, function(item){
          if(item.$id == myMarkerId){
            myItem = item;
          }
        });

        if(myItem){
          $scope.me = myItem;
          $scope.name = myItem.name;
        }
        else{
          addMyMarker($scope.initialPosition);
        }
    }

    function cb() {
        firebasePromise.resolve();
    }

    function positionUpdated(position) {
      debugger;
        if (!$scope.initialPosition) {
            $scope.initialPosition = position;
            locationPromise.resolve(position);
        } else if ($scope.me) {
            updateMyMarkerPosition(position);
        }
    }

    function addMyMarker(position) {
        $scope.meRef = $scope.items.add({
            name: $scope.name,
            latlng: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }
        }, testAdd);
        
        $cookies.myMarkerId = $scope.meRef.name();
    }

    function testAdd() {
        $scope.me = $scope.items.getByName($scope.meRef.name());
    }    

    $scope.save = function () {
        if ($scope.me) {
            $scope.me.name = $scope.name;
            $scope.items.update($scope.me);
        }
    }

    function getCallbackFn() {
        var callBacks = {};
        callBacks.childAdded = function (item) {
            console.log('childAdded');
            var marker = new google.maps.Marker({
                map: $scope.myMap,
                position: new google.maps.LatLng(item.latlng.lat, item.latlng.lng)
            });
            marker.data = item;

            $scope.markerIndex[item.$id] = marker;

            $scope.myMarkers.push(marker);
        };
        callBacks.childRemoved = function (item) {
            console.log('childRemoved', item)
        };
        callBacks.childUpdated = function (item) {
            //lookup Marker

            var marker = $scope.markerIndex[item.$id];
            marker.data.name = item.name;
            $scope.setMarkerPosition(marker, item.latlng.lat, item.latlng.lng);

        };

        return callBacks;
    }

    function updateMyMarkerPosition(position) {
        $scope.me.latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        $scope.items.update($scope.me);
    }


    $scope.openMarkerInfo = function (marker) {
        $scope.currentMarker = marker;
        $scope.myInfoWindow.open($scope.myMap, marker);
    };

    $scope.setMarkerPosition = function (marker, lat, lng) {
        marker.setPosition(new google.maps.LatLng(lat, lng));
    };

});