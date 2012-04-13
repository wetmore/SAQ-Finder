<?php
$addressraw = $_POST['address'];
$address = urlencode($addressraw);
$url = "http://maps.googleapis.com/maps/api/geocode/json?address=" . $address . "&sensor=true";
$data = file_get_contents($url);
$decdata = json_decode($data);
$arr = get_object_vars($decdata);
$status = $arr["status"];
$days = array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");
$pos = array();
if ($status == "OK") {
  $arr = $arr["results"];
  $arr = get_object_vars($arr[0]);
  $geometry = $arr["geometry"];
  $pos[0] = $geometry->location->lat;
  $pos[1] = $geometry->location->lng;
} elseif ($status == "ZERO_RESULTS") {
  echo "none";
} elseif ($status == "INVALID_REQUEST") {
  echo "invalid";
} else {
  echo "other";
}
if (sizeof($pos) != 0) {
  $url = "http://www.saq.com/webapp/wcs/stores/servlet/RechercheSuccursale?langId=-1&storeId=10001&catalogId=10001&country=CA&latitude=" . $pos[0] . "&longitude=" . $pos[1] . "&transaction=search&searchQuantifier=AND&radius=10&maxSearchResults=5&units=km";
  $stores = array();
  $stores[0] = $pos;
  $page = file_get_contents($url);
  $regex = "/this.(user[1-9]|address|latitude|longitude) = '(.*)'/";
  preg_match_all($regex,$page,$matches);
  $current_index = 0;
  //var_dump($matches);
  for($i=8;$i < count($matches[1]);$i++) {
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
        preg_match_all("/(F|[0-9]{2}:[0-9]{2})/",$matches[2][$i],$times_uf);
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

