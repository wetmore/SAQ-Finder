$(function() {
  
  //SAQ model
  window.Saq = Backbone.Model.extend({
    initialize: function() {
      this.checkIfOpen();
      this.set({selected: false});
    },
    checkIfOpen: function() {
      var today = new Date();
      var open = this.get('times')[today.getDay()].open;
      var close = this.get('times')[today.getDay()].close;
      var openHr = open.split(':')[0];
      var openMin = open.split(':')[1];
      var closeHr = close.split(':')[0];
      var closeMin = close.split(':')[1];
      var curHr = today.getHours();
      var curMin = today.getMinutes();
      var isOpen = ((curHr > openHr || (curHr == openHr && curMin >= openMin)) &&
                    (curHr < closeHr || (curHr == closeHr && curMin < closeMin))
                   );
      this.set({open: isOpen});
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
    events: { 'click div.store-info' : 'showDetails' },
    initialize: function() {
      this.model.bind('change:selected', this.handleSelection, this);
      this.model.bind('destroy', this.remove, this);
    },
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setText();
      return this;
    },
    setText: function() {
      var hours = this.model.get('times')[new Date().getDay()];
      var hoursInfo = hours.open + ' - ' + hours.close;
      var text = this.model.get('type') + ': ' + hoursInfo + (this.model.get('open')?'':' (closed)');
      // TODO: comment me
      ((this.$)('.store-info')).text(text);
    },
    showDetails: function() {
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
    timeInt: null,
    timeInfo: 'empty',
    initialize: function() {
      $(this.el).hide();
      var self = this;
      // every 20 seconds, check if the store is near closing or opening.
      var checkCriticalTimes = function() {
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
          return parseInt(hr) * 60 + parseInt(min);
        };
        var minsToClose = mins(closeHr, closeMin) - mins(curHr, curMin);
        if (self.model.get('open') && minsToClose < 8 * 60) {
          var hours = Math.floor(minsToClose / 60);
          var min = minsToClose % 60;
          self.timeInfo = 'Closes in ' + hours + ':' + ((min < 10) ? '0' : '') + min;
          self.render(self);
        }
        var minsToOpen = mins(curHr, curMin) - mins(openHr, openMin);
        if (!self.model.get('open') && minsToOpen < 1 * 60) {
          var hours = Math.floor(minsToOpen / 60);
          var min = minsToOpen % 60;
          self.timeInfo = 'Opens in ' + hours + ':' + ((min < 10) ? '0' : '') + min;
          self.render(self);
        }
      }(); // execute immediately
      this.timeInt = setInterval(checkCriticalTimes, 20000);
    },
    render: function(ctx) {
      var variables = {
        storeType: ctx.model.get('type'),
        storePhone: ctx.model.get('phone'),
        storeTimeInfo: ctx.timeInfo
      }
      
      this.template = _.template($('#infopane-template').html(), variables),
      this.el.html(this.template);
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
    initialize: function() {
      Stores.bind('add', this.addStoreMarker, this);
      Stores.bind('remove', this.remStoreMarker, this);
      App.bind('locateStores', this.addLocMarker, this);
      var options = {
        center: new google.maps.LatLng(45.509475, -73.577328),
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
      this.map = new google.maps.Map(this.el[0], options);
    },
    render: function() {
      return this;
    },
    addLocMarker: function(pos) {
      var self = this;
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
      this.map.panTo(this.locMarker.getPosition());
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
    },
    remStoreMarker: function(store) {
      this.markers[store.id].setMap();
      delete this.markers[store.id];
    },
    selectStoreMarker: function(store) {
      this.map.panTo(this.markers[store.id].getPosition());
      if (this.view !== null) {
        clearInterval(this.view.timeInt);
      }
      if (this.infoWindow !== null) {
        this.infoWindow.close();
      }
      this.view = new StoreInfo({model: store, el: $('#infopane')});
      this.infoWindow.setContent($('#infopane').html());
      this.infoWindow.open(this.map, this.markers[store.id]);
    }
  });

  //App view
  window.AppView = Backbone.View.extend({
    el: $('#app'),
    events: { 'keypress #address-input' : 'createOnEnter',
              'click #find'             : 'findMe' },
    initialize: function() {
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
          self.trigger('storeLocComplete');
        }
      });
    },
    clear: function() {
      _.each(Stores.these(), function(m) {m.destroy();});
      return false;
    }
  });

  window.App = new AppView;
  window.Map = new MapView;
});
