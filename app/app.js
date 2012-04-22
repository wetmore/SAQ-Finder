$(function() { 
  //SAQ model
  window.Saq = Backbone.Model.extend({
    timeout: null,
    initialize: function() {
      var self = this;
      var checkIfOpen = function() {
        var today = new Date();
        var open = self.get('times')[today.getDay()].open;
        var close = self.get('times')[today.getDay()].close;
        var closedForDay = false;
        if (open === 'F' || close === 'F') {
          isOpen = false;
          closedForDay = true;
        } else {
          var openHr = parseInt(open.split(':')[0], 10);
          var openMin = parseInt(open.split(':')[1], 10);
          var closeHr = parseInt(close.split(':')[0], 10);
          var closeMin = parseInt(close.split(':')[1], 10);
          var curHr = today.getHours();
          var curMin = today.getMinutes();
          var isOpen = ((curHr > openHr || (curHr == openHr && curMin >= openMin)) &&
                        (curHr < closeHr || (curHr == closeHr && curMin < closeMin))
                       );
        }
        self.set({open: isOpen});
        if (curHr > closeHr || (curHr == closeHr && curMin >= closeMin)) {
          closedForDay = true;
        }
        if (isOpen) {
          var closeDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                                   closeHr, closeMin);
          timeTilUpdate = closeDate.getTime() - Date.now();
        } else if (!closedForDay) {
          var openDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                                   openHr, openMin);
          timeTilUpdate = openDate.getTime() - Date.now();
        } else {
          tomorrow = (today.getDay() + 1) % 7;
          var midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                                    23, 59, 59);
          timeTilUpdate = midnight.getTime() - Date.now() + 2*60*1000;
        }
        if (timeTilUpdate < 0) {
          console.error('Time until update is negative: ' + timeTilUpdate);
        } else {
          self.timeout = setTimeout(checkIfOpen, timeTilUpdate);
        }
      }
      checkIfOpen();
      this.set({selected: false});
    },
    remove: function() {
      clearTimeout(this.timeout);
      this.destroy();
    }
  });

  //Store List Collection
  window.StoreList = Backbone.Collection.extend({
    model: Saq,
    localStorage: new Store('stores'),
    these: function() {
      return $.extend(true, [], this.models);
    }
  });

  window.Stores = new StoreList;

  //Store view
  window.StoreView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#store-template').html()),
    events: { 'click div.store-info' : 'selectStore' },
    initialize: function() {
      this.model.bind('change:selected', this.handleSelection, this);
      this.model.bind('change:open', this.setText, this);
      this.model.bind('destroy', this.remove, this);
    },
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setText();
      return this;
    },
    setText: function() {
      var hours = this.model.get('times')[new Date().getDay()];
      if (hours.open !== 'F') {
        var hoursInfo = hours.open + ' - ' + hours.close;
        var text = this.model.get('type') + ': ' + hoursInfo + (this.model.get('open')?'':' (closed)');
      } else {
        var text = this.model.get('type') + ': closed all day';
      }
      // TODO: comment me
      ((this.$)('.store-info')).text(text);
    },
    selectStore: function() {
      this.model.set({'selected': true});
    },
    handleSelection: function() {
      if (this.model.get('selected') === true) {
        _.each(Stores.these(), function(store) {
          if (store !== this.model)
            store.set({selected: false});
        });
        Map.selectStoreMarker(this.model);
      }
    },
    remove: function() {
      $(this.el).remove();
    }
  });

  //Store info view (used in popup info pane on map)
  window.StoreInfo = Backbone.View.extend({
    template: null,
    id: 'infopane',
    timeInt: null,
    events: {'click #walk': 'route'},
    initialize: function() {
      $('#infopane-container').append(this.el);
      var self = this;
        var checkCriticalTimes = function() {
        var firstCall = (self.timeInfo === undefined);
        var today = new Date();
        var open = self.model.get('times')[today.getDay()].open;
        var close = self.model.get('times')[today.getDay()].close;
        var openHr = open.split(':')[0];
        var openMin = open.split(':')[1];
        var closeHr = close.split(':')[0];
        var closeMin = close.split(':')[1];
        var curHr = today.getHours();
        var curMin = today.getMinutes();
        var mins = function(hr, min) {
          return parseInt(hr, 10) * 60 + parseInt(min, 10);
        };
        var minsToClose = mins(closeHr, closeMin) - mins(curHr, curMin);
        var minsToOpen = mins(openHr, openMin) - mins(curHr, curMin);
        if (self.model.get('open') && minsToClose < 8 * 60) {
          var hours = Math.floor(minsToClose / 60);
          var min = minsToClose % 60;
          self.timeInfo = 'Closes in ' + hours + ':' + ((min < 10) ? '0' : '') + min;
          self.render();
        } else if (!self.model.get('open') && minsToOpen < 1 * 60 && minsToOpen > 0) {
          var hours = Math.floor(minsToOpen / 60);
          var min = minsToOpen % 60;
          self.timeInfo = 'Opens in ' + hours + ':' + ((min < 10) ? '0' : '') + min;
          self.render();
        } else {
          self.timeInfo = '';
          self.render();
        }
        if (!firstCall) {
          self.timeInt = setTimeout(checkCriticalTimes, 60000);
        }
      };
      checkCriticalTimes();

      var d = new Date();
      var nextMin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()+1);
      this.timeInt = setTimeout(checkCriticalTimes, nextMin.getTime() - Date.now());
    },
    route: function() {
      Map.calcRoute(this.model);
    },
    render: function() {
      this.trigger('render');
      var variables = {
        storeType: this.model.get('type'),
        storePhone: this.model.get('phone'),
        storeTimeInfo: this.timeInfo,
        times: this.model.get('times'),
        hours_template: _.template($('#hours-template').html())
      }
      this.template = _.template($('#infopane-template').html(), variables),
      $(this.el).html(this.template);
      return this;
    }
  });

  //Map view
  window.MapView = Backbone.View.extend({
    el: $('#map'),
    infoWindow: new google.maps.InfoWindow({}),
    view: null,
    markers: {},
    locMarker: null,
    dirRenderer: new google.maps.DirectionsRenderer({
      suppressMarkers: true
    }),
    dirService: new google.maps.DirectionsService(),
    bounds: new google.maps.LatLngBounds(
      new google.maps.LatLng(44.9913580, -79.76279860),
      new google.maps.LatLng(62.58305530, -57.1054860)
    ),
    initialize: function() {
      Stores.bind('add', this.addStoreMarker, this);
      Stores.bind('remove', this.remStoreMarker, this);
      App.bind('locateStores', this.addLocMarker, this);
      var options = {
        center: this.bounds.getCenter(),
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
      this.map = new google.maps.Map(this.el[0], options);
      this.map.fitBounds(this.bounds);
    },
    render: function() {
      this.map.setCenter(this.bounds.getCenter());
      this.map.fitBounds(this.bounds);
      return this;
    },
    addLocMarker: function(pos) {
      var self = this;
      this.clearRoute();
      if (this.locMarker !== null)
        this.locMarker.setMap();
      this.locMarker = new StyledMarker({
        styleIcon: new StyledIcon(StyledIconTypes.MARKER, {color: '6cc0e5'}),
        position: new google.maps.LatLng(pos[0], pos[1]),
        map: this.map,
        draggable: true
      });
      google.maps.event.addListener(this.locMarker, 'dragend', function() {
        var ltlng = self.locMarker.getPosition();
        App.create(ltlng.lat() + ',' + ltlng.lng());
      });
      this.bounds = new google.maps.LatLngBounds();
      //TODO extend bounds
      //this.render();
      //this.map.panTo(this.locMarker.getPosition());
    },
    addStoreMarker: function(store) {
      var self = this;
      var markColor = store.get('open') ? '8ab846' : 'fb4f4f';
      this.markers[store.id] = new StyledMarker({
        styleIcon: new StyledIcon(StyledIconTypes.MARKER, {color: markColor}),
        position: new google.maps.LatLng(store.get('lat'), store.get('long')),
        map: this.map
      });
      this.markers[store.id].associatedStore = store;
      google.maps.event.addListener(this.markers[store.id], 'click', function() {
        store.set({'selected': true});
      });
      this.bounds.extend(this.markers[store.id].getPosition());
      this.render();
      store.bind('change:open', function() {
        self.markers[store.id].styleIcon.set('color', (store.get('open') ? '8ab846' : 'fb4f4f'));
      });
    },
    remStoreMarker: function(store) {
      this.markers[store.id].setMap();
      delete this.markers[store.id];
    },
    selectStoreMarker: function(store) {
      var self = this;
      this.map.panTo(this.markers[store.id].getPosition());
      if (this.view !== null) {
        clearTimeout(this.view.timeInt);
      }
      if (this.infoWindow !== null) {
        this.infoWindow.close();
      }
      this.view = new StoreInfo({model: store});
      this.infoWindow.setContent($('#infopane')[0]);
      this.infoWindow.open(this.map, this.markers[store.id]);
    },
    calcRoute: function(store) {
      var self = this;
      this.infoWindow.close();
      var start = this.locMarker.getPosition();
      var end = this.markers[store.id].getPosition();
      var request = {
        origin: start,
        destination: end,
        travelMode: google.maps.TravelMode.WALKING
      };
      this.dirService.route(request, function (result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
          self.dirRenderer.setDirections(result);
        }
      });
      this.dirRenderer.setMap(this.map);
    },
    clearRoute: function() {
      this.dirRenderer.setMap(null);
      this.render();
    }
  });

  //App view
  window.AppView = Backbone.View.extend({
    el: $('#app'),
    events: { 'keypress #address-input' : 'createOnEnter',
              'click #find'             : 'findMe' },
    initialize: function() {
      $('#loader').hide();
      this.input = this.$('#address-input');
      Stores.bind('add', this.addOne, this);
      Stores.bind('all', this.render, this);
    },
    render: function() {
      //console.log(Stores.length);
    },
    addOne: function(store) {
      var view = new StoreView({model: store});
      this.$('#results-list').append(view.render().el);
    },
    findMe: function() {
      var self = this;
      console.log('searching for user\'s location');
      //geolocate
      $('#find').attr('disabled', true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
          var pos = new google.maps.LatLng(position.coords.latitude,
                                           position.coords.longitude);
          var geocoder = new google.maps.Geocoder();
          geocoder.geocode({'latLng': pos}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
              if (results[0]) {
                console.log(results);
                self.create(results[0].formatted_address);
                App.bind('storeLocComplete', function() {
                  $('#find').attr('disabled', false);
                });
              } else {
                console.log('failed due to ' + status);
                $('#find').attr('disabled', false);
              }
            }
          });
        }, function() {
          handleNoGeolocation(true);
        });
      } else {
        handleNoGeolocation(false);
      }
      function handleNoGeolocation(errorFlag) {
        if (errorFlag) {
          var content = 'Error: The geolocation service failed.';
        } else {
          var content = 'Error: Your browser doesn\'t support geolocation.';
        }
        console.log(content);
        $('#find').attr('disabled', false);
      }
    },
    createOnEnter: function(e) {
      var text = this.input.val();
      if (!text || e.keyCode != 13) return;
      this.create(text);
      this.input.val('');
    },
    create: function(text) {
      $('#find').attr('disabled', true);
      $('#loader').show();
      this.clear();
      var self = this;
      console.log('requesting address: '+text);
      text = 'address='+text;
      $.ajax({
        type: 'POST',
        url: 'scripts/geo.php',
        data: text,
        success: function(response, textStatus, jqXHR) {
          console.log(response);
          if (response.indexOf('none') != -1) {
            console.log('no results returned');
          } else if (response.indexOf('invalid') != -1) {
            console.log('invalid request');
          } else if (response.indexOf('other') != -1) {
            console.log('other issue');
          } else {
            var responseObj = $.parseJSON(response);
            self.trigger('locateStores', responseObj.splice(0,1)[0]);
            for (var x in responseObj) {
              Stores.create(responseObj[x]);
            }
          }
        },
        error: function(jqXHR, textStatus, errorThrown) {
          console.log(textStatus);
        },
        complete: function() {
          $('#loader').hide();
          self.trigger('storeLocComplete');
        }
      });
    },
    clear: function() {
      _.each(Stores.these(), function(m) {
        m.remove();
      });
      return false;
    }
  });

  window.App = new AppView;
  window.Map = new MapView;
});
