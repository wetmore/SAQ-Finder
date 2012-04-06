<?php
$addressraw = $_POST['address'];
$address = urlencode($addressraw);
$url = "http://maps.googleapis.com/maps/api/geocode/json?address=" . $address . "&sensor=true";
$data = file_get_contents($url);
$decdata = json_decode($data);
$arr = get_object_vars($decdata);
$status = $arr["status"];
$postal = "";
$days = array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");
$pos = array();
if ($status == "OK") {
  $arr = $arr["results"];
  $arr = get_object_vars($arr[0]);
  $geometry = $arr["geometry"];
  $arr = $arr["address_components"];
  $foundPostal = False;
  foreach ($arr as $value) {
    $component = get_object_vars($value);
    if ($component["types"][0] == "postal_code") {
      $postal = preg_replace('/\s+/','',$component["short_name"]);
      $foundPostal = True;
    }
  }
  $pos[0] = $geometry->location->lat;
  $pos[1] = $geometry->location->lng;
  if (!($foundPostal)) {
    echo "none";
  }
} elseif ($status == "ZERO_RESULTS") {
  echo "none";
} elseif ($status == "INVALID_REQUEST") {
  echo "invalid";
} else {
  echo "other";
}
if ($postal != "") {
  $base_url = "http://www.saq.com/webapp/wcs/stores/servlet/afficherCarte?pwidth=494&pheight=324&maxSearchResults=5&pageResults=20&coderegion=index.html&storeId=10001&catalogId=10001&langId=-1&country=CA&stateProvince=QC&transaction=search&searchQuantifier=AND&radius=2000&maxSearchResults=5&postalCode=";
  $url = $base_url . $postal;
  $stores = array();
  $stores[0] = $pos;
  $page = file_get_contents($url);
  $regex = "/this.(user[1-9]|address|latitude|longitude) = '(.*)'/";
  preg_match_all($regex,$page,$matches);
  $current_index = 0;
  for($i=4;$i < count($matches[1]);$i++) {
    switch ($matches[1][$i]) {
      case "address":
        $current_index++;
      $stores[$current_index]['address'] = $matches[2][$i];
      break;
      case "latitude":
        $stores[$current_index]['lat'] = $matches[2][$i];
      break;
      case "longitude":
        $stores[$current_index]['long'] = $matches[2][$i];
      break;
      case "user2":
        $stores[$current_index]['phone'] = $matches[2][$i];
      break;
      case "user5":
        $stores[$current_index]['type'] = $matches[2][$i];
      break;
      case "user8":
        preg_match_all("/([0-9]{2}:[0-9]{2})/",$matches[2][$i],$times_uf);
        $times = array();
        for ($j = 0; $j < 7; $j++) {
          $times[$j] = array(
            'open' => $times_uf[0][$j * 2],
            'close' => $times_uf[0][$j * 2 + 1],
            'day' => $days[$j]
            );
        }
        $stores[$current_index]['times'] = $times;
      break;
    }
  }
  echo json_encode($stores);
}
?>

