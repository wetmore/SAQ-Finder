$(function() {
  
  //SAQ model
  window.Saq = Backbone.Model.extend({
    initialize: function() {
      this.checkIfOpen();
    },
    checkIfOpen: function() {
      var today = new Date();
      var open = this.get('times')[today.getDay()].open;
      var close = this.get('times')[today.getDay()].close;
      var hr = today.getHours();
      var min = today.getMinutes();
      var isOpen = ( (hr > open.split(':')[0] || 
                         (hr == open.split(':')[0] && min >= open.split(':')[1])) &&
                         (hr < close.split(':')[0] || 
                         (hr == close.split(':')[0] && min < close.split(':')[1]))
                   );
      this.set({ open: isOpen });
    }
  });

  //Store List Collection
  window.StoreList = Backbone.Collection.extend({
    model: Saq,
    localStorage: new Store("stores"),
    these: function() {
      //hacky old way --> return this.filter(function(e){ return true });
      return $.extend(true, [], this.models);
    }
  });

  window.Stores = new StoreList;
  
  //Store view
  window.StoreView = Backbone.View.extend({
    tagName: "li",
    template: _.template($('#store-template').html()),
    events: { "click div.store-info" : "showDetails" },
    initialize: function() {
      console.log("created store view");
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
      console.log("show details");
      this.model.checkIfOpen();
      console.log(this.model.get('open'));
    },
    remove: function() {
      $(this.el).remove();
    }
  });

  //Map view

  window.MapView = Backbone.View.extend({
    el: $("#map"),
    markers: [],
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
      if (this.locMarker !== null)
        this.locMarker.setMap();
      this.locMarker = new google.maps.Marker({
        position: new google.maps.LatLng(pos[0], pos[1]),
        map: this.map,
        animation: google.maps.Animation.BOUNCE
      });
      this.map.panTo(this.locMarker.getPosition());
    },
    addStoreMarker: function(store) {
      this.markers.push(new google.maps.Marker({
        position: new google.maps.LatLng(store.get('lat'), store.get('long')),
        map: this.map
      }));
      var lastIndex = this.markers.length - 1;
      this.markers[lastIndex].store = store;
      google.maps.event.addListener(this.markers[lastIndex], 'click', this.selectMarker);
    },
    remStoreMarker: function(store) {
      var i;
      for (i = 0; i < this.markers.length; i++) {
        if (this.markers[i].store === store) {
          this.markers[i].setMap();
          break;
        }
      }
      this.markers.splice(i, 1);
    },
    selectMarker: function() {
    }
  });

  //App view
  window.AppView = Backbone.View.extend({
    el: $("#app"),
    events: { "keypress #address-input" : "createOnEnter",
              "click #find"             : "findMe" },
    initialize: function() {
      this.input = this.$("#address-input");
      Stores.bind('add', this.addOne, this);
      Stores.bind('all', this.render, this);
    },
    render: function() {
      //console.log(Stores.length);
    },
    addOne: function(store) {
      var view = new StoreView({model: store});
      this.$("#results-list").append(view.render().el);
    },
    findMe: function() {
      var self = this;
      console.log("searching for user's location");
      //geolocate
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
          var pos = new google.maps.LatLng(position.coords.latitude,
                                           position.coords.longitude);
          var geocoder = new google.maps.Geocoder();
          geocoder.geocode({'latLng': pos}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
              if (results[0]) {
                console.log(results);
                console.log(results[0].formatted_address);
                self.create(results[0].formatted_address);
              } else {
                console.log("failed due to " + status);
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
      }
      
    },
    createOnEnter: function(e) {
      var text = this.input.val();
      if (!text || e.keyCode != 13) return;
      this.create(text);
      this.input.val('');
    },
    create: function(text) {
      this.clear();
      var self = this;
      console.log("requesting address: "+text);
      text = "address="+text;
      $.ajax({
        type: "POST",
        url: "scripts/geo.php",
        data: text,
        success: function(response, textStatus, jqXHR) {
          console.log(response);
          if (response.indexOf("none") != -1) { 
            console.log("no results returned");
          } else if (response.indexOf("invalid") != -1) {
            console.log("invalid request");
          } else if (response.indexOf("other") != -1) { 
            console.log("other issue");
          } else {
            var responseObj = $.parseJSON(response);
            console.log(self);
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
        }
      });
    },
    clear: function() {
      _.each(Stores.these(),function(m){ m.destroy(); });
      return false;
    }
  });

  window.App = new AppView;
  window.Map = new MapView;
});
