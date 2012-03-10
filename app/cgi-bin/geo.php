<?php
$addressraw = $_POST['address'];
$address = urlencode($addressraw);
$url = "http://maps.googleapis.com/maps/api/geocode/json?address=" . $address . "&sensor=true";
$data = file_get_contents($url);
$decdata = json_decode($data);
$arr = get_object_vars($decdata);
$status = $arr["status"];
$postal = "";
if ($status == "OK") {
    $arr = $arr["results"];
    $arr = get_object_vars($arr[0]);
    $arr = $arr["address_components"];
    $foundPostal = False;
    foreach ($arr as $value) {
        $component = get_object_vars($value);
        if ($component["types"][0] == "postal_code") {
            $postal = preg_replace('/\s+/','',$component["short_name"]);
            $foundPostal = True;
        }
    }
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
    $page = file_get_contents($url);
    $regex = "/this.(user[1-9]|address|latitude|longitude) = '(.*)'/";
    preg_match_all($regex,$page,$matches);
    $current_index = -1;
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
                $times[0]['open'] = $times_uf[0][0];
                $times[0]['close'] = $times_uf[0][1];
                $times[1]['open'] = $times_uf[0][2];
                $times[1]['close'] = $times_uf[0][3];
                $times[2]['open'] = $times_uf[0][4];
                $times[2]['close'] = $times_uf[0][5];
                $times[3]['open'] = $times_uf[0][6];
                $times[3]['close'] = $times_uf[0][7];
                $times[4]['open'] = $times_uf[0][8];
                $times[4]['close'] = $times_uf[0][9];
                $times[5]['open'] = $times_uf[0][10];
                $times[5]['close'] = $times_uf[0][11];
                $times[6]['open'] = $times_uf[0][12];
                $times[6]['close'] = $times_uf[0][13];
                $stores[$current_index]['times'] = $times;
                break;
        }
    }
    echo json_encode($stores);
}
?>

