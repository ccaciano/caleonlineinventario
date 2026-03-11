#!/usr/bin/env python3
"""
Comprehensive Backend API Test Script for Inventory Management System
Tests all endpoints with realistic data scenarios.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import uuid

# Base URL from frontend/.env
BASE_URL = "https://stock-counter-pwa.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def make_request(method, endpoint, data=None, expected_status=200):
    """Make HTTP request and handle response"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url)
        elif method.upper() == "POST":
            response = requests.post(url, json=data)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data)
        elif method.upper() == "DELETE":
            response = requests.delete(url)
        else:
            print_error(f"Unsupported method: {method}")
            return None
        
        print_info(f"{method.upper()} {endpoint} -> Status: {response.status_code}")
        
        if response.status_code != expected_status:
            print_error(f"Expected status {expected_status}, got {response.status_code}")
            try:
                error_detail = response.json()
                print_error(f"Error details: {error_detail}")
            except:
                print_error(f"Response text: {response.text}")
            return None
        
        try:
            return response.json()
        except json.JSONDecodeError:
            if response.status_code == 200:
                return {"success": True, "text": response.text}
            return None
    
    except requests.exceptions.RequestException as e:
        print_error(f"Request failed: {str(e)}")
        return None

def test_store_configuration():
    """Test store configuration endpoints"""
    print(f"\n{Colors.BOLD}=== Testing Store Configuration ==={Colors.ENDC}")
    
    # Test data
    store_config = {
        "store_id": "STORE001",
        "store_name": "Super Market Central",
        "email": "manager@supermarket.com",
        "manager_phone": "+1234567890",
        "manager_name": "Maria Silva"
    }
    
    # Test 1: Save store configuration
    print_info("Testing POST /store/config")
    result = make_request("POST", "/store/config", store_config)
    if result and result.get("success"):
        print_success("Store configuration saved successfully")
    else:
        print_error("Failed to save store configuration")
        return False
    
    # Test 2: Retrieve store configuration
    print_info("Testing GET /store/config")
    result = make_request("GET", "/store/config")
    if result and result.get("store_id") == store_config["store_id"]:
        print_success("Store configuration retrieved successfully")
        print_info(f"Retrieved: {result}")
        return True
    else:
        print_error("Failed to retrieve store configuration")
        return False

def test_inventory_management():
    """Test inventory management endpoints"""
    print(f"\n{Colors.BOLD}=== Testing Inventory Management ==={Colors.ENDC}")
    
    # Test data for inventories
    today = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    inventory1_data = {
        "description": "Monthly Stock Count - Electronics Section",
        "date": today
    }
    
    inventory2_data = {
        "description": "Quarterly Audit - Pharmacy Department",
        "date": tomorrow
    }
    
    # Test 1: Create first inventory
    print_info("Testing POST /inventories (Inventory 1)")
    inventory1 = make_request("POST", "/inventories", inventory1_data)
    if inventory1 and inventory1.get("_id"):
        print_success(f"Inventory 1 created with ID: {inventory1['_id']}")
        inventory1_id = inventory1["_id"]
    else:
        print_error("Failed to create inventory 1")
        return None, None
    
    # Test 2: Create second inventory
    print_info("Testing POST /inventories (Inventory 2)")
    inventory2 = make_request("POST", "/inventories", inventory2_data)
    if inventory2 and inventory2.get("_id"):
        print_success(f"Inventory 2 created with ID: {inventory2['_id']}")
        inventory2_id = inventory2["_id"]
    else:
        print_error("Failed to create inventory 2")
        return inventory1_id, None
    
    # Test 3: Get all inventories
    print_info("Testing GET /inventories")
    inventories = make_request("GET", "/inventories")
    if inventories and isinstance(inventories, list) and len(inventories) >= 2:
        print_success(f"Retrieved {len(inventories)} inventories")
        for inv in inventories:
            print_info(f"  - {inv.get('description', 'N/A')} (Items: {inv.get('item_count', 0)})")
    else:
        print_error("Failed to retrieve inventories list")
    
    # Test 4: Get specific inventory details
    print_info(f"Testing GET /inventories/{inventory1_id}")
    inventory_detail = make_request("GET", f"/inventories/{inventory1_id}")
    if inventory_detail and inventory_detail.get("_id") == inventory1_id:
        print_success("Retrieved inventory details successfully")
        print_info(f"Status: {inventory_detail.get('status', 'unknown')}")
    else:
        print_error("Failed to retrieve inventory details")
    
    return inventory1_id, inventory2_id

def test_counted_items(inventory_id):
    """Test counted items endpoints"""
    print(f"\n{Colors.BOLD}=== Testing Counted Items (Inventory: {inventory_id}) ==={Colors.ENDC}")
    
    if not inventory_id:
        print_error("No inventory ID provided for testing items")
        return []
    
    # Test data for items
    items_data = [
        {
            "product_code": "SKU001234",
            "quantity": 25,
            "lot": "LOT2024001",
            "expiry_date": "2025-12-31"
        },
        {
            "product_code": "SKU005678",
            "quantity": 150,
            "lot": "LOT2024002",
            "expiry_date": "2026-06-15"
        },
        {
            "product_code": "SKU009999",
            "quantity": 8,
            "lot": "LOT2024003", 
            "expiry_date": "2024-12-01"
        }
    ]
    
    item_ids = []
    
    # Test 1: Add items to inventory
    for i, item_data in enumerate(items_data, 1):
        print_info(f"Testing POST /inventories/{inventory_id}/items (Item {i})")
        item = make_request("POST", f"/inventories/{inventory_id}/items", item_data)
        if item and item.get("_id"):
            print_success(f"Item {i} added with ID: {item['_id']}")
            item_ids.append(item["_id"])
        else:
            print_error(f"Failed to add item {i}")
    
    # Test 2: Get all items for inventory
    print_info(f"Testing GET /inventories/{inventory_id}/items")
    items = make_request("GET", f"/inventories/{inventory_id}/items")
    if items and isinstance(items, list):
        print_success(f"Retrieved {len(items)} items for inventory")
        for item in items:
            print_info(f"  - {item.get('product_code', 'N/A')} | Qty: {item.get('quantity', 0)} | Lot: {item.get('lot', 'N/A')}")
    else:
        print_error("Failed to retrieve items")
    
    # Test 3: Update an item (if we have items)
    if item_ids:
        first_item_id = item_ids[0]
        update_data = {
            "quantity": 30,
            "lot": "LOT2024001-UPDATED"
        }
        print_info(f"Testing PUT /inventories/{inventory_id}/items/{first_item_id}")
        updated_item = make_request("PUT", f"/inventories/{inventory_id}/items/{first_item_id}", update_data)
        if updated_item and updated_item.get("quantity") == 30:
            print_success("Item updated successfully")
            print_info(f"New quantity: {updated_item.get('quantity')}, New lot: {updated_item.get('lot')}")
        else:
            print_error("Failed to update item")
    
    # Test 4: Delete an item (if we have multiple items)
    if len(item_ids) > 1:
        delete_item_id = item_ids[-1]  # Delete the last item
        print_info(f"Testing DELETE /inventories/{inventory_id}/items/{delete_item_id}")
        result = make_request("DELETE", f"/inventories/{inventory_id}/items/{delete_item_id}")
        if result and result.get("success"):
            print_success("Item deleted successfully")
            item_ids.remove(delete_item_id)  # Remove from our tracking list
        else:
            print_error("Failed to delete item")
    
    return item_ids

def test_export_functionality(inventory_id):
    """Test export data endpoint"""
    print(f"\n{Colors.BOLD}=== Testing Export Functionality ==={Colors.ENDC}")
    
    if not inventory_id:
        print_error("No inventory ID provided for testing export")
        return False
    
    # Test: Get export data
    print_info(f"Testing GET /inventories/{inventory_id}/export")
    export_data = make_request("GET", f"/inventories/{inventory_id}/export")
    
    if export_data:
        # Check if all required sections are present
        required_sections = ["store", "inventory", "items"]
        missing_sections = []
        
        for section in required_sections:
            if section not in export_data:
                missing_sections.append(section)
        
        if not missing_sections:
            print_success("Export data retrieved successfully")
            
            # Display summary
            store_data = export_data.get("store", {})
            inventory_data = export_data.get("inventory", {})
            items_data = export_data.get("items", [])
            
            print_info(f"Store: {store_data.get('store_name', 'N/A')}")
            print_info(f"Inventory: {inventory_data.get('description', 'N/A')}")
            print_info(f"Items count: {len(items_data)}")
            
            return True
        else:
            print_error(f"Export data missing sections: {missing_sections}")
            return False
    else:
        print_error("Failed to retrieve export data")
        return False

def test_inventory_closure(inventory_id):
    """Test inventory closure and validation"""
    print(f"\n{Colors.BOLD}=== Testing Inventory Closure ==={Colors.ENDC}")
    
    if not inventory_id:
        print_error("No inventory ID provided for testing closure")
        return False
    
    # Test 1: Close inventory
    print_info(f"Testing PUT /inventories/{inventory_id}/close")
    result = make_request("PUT", f"/inventories/{inventory_id}/close")
    if result and result.get("success"):
        print_success("Inventory closed successfully")
    else:
        print_error("Failed to close inventory")
        return False
    
    # Test 2: Verify inventory is closed
    print_info(f"Verifying inventory status after closure")
    inventory = make_request("GET", f"/inventories/{inventory_id}")
    if inventory and inventory.get("status") == "closed":
        print_success("Inventory status confirmed as 'closed'")
    else:
        print_error("Inventory status not updated properly")
    
    # Test 3: Try to add item to closed inventory (should fail)
    print_info("Testing item addition to closed inventory (should fail)")
    test_item = {
        "product_code": "TEST_CLOSED",
        "quantity": 1,
        "lot": "TEST",
        "expiry_date": "2025-01-01"
    }
    
    # For this test, we expect a 400 status and the request should return None (error)
    result = make_request("POST", f"/inventories/{inventory_id}/items", test_item, expected_status=400)
    
    # Check if the request actually returned 400 by making the request manually
    try:
        url = f"{BASE_URL}/inventories/{inventory_id}/items"
        response = requests.post(url, json=test_item)
        if response.status_code == 400:
            print_success("Correctly prevented item addition to closed inventory")
            try:
                error_detail = response.json()
                if "closed inventory" in error_detail.get("detail", "").lower():
                    print_info(f"Correct error message: {error_detail.get('detail')}")
                else:
                    print_warning(f"Unexpected error message: {error_detail.get('detail')}")
            except:
                pass
            return True
        else:
            print_error(f"Unexpectedly got status {response.status_code} instead of 400")
            return False
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return False

def test_comprehensive_scenario():
    """Run comprehensive test scenario as specified in the request"""
    print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}COMPREHENSIVE INVENTORY MANAGEMENT API TEST{Colors.ENDC}")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    
    test_results = {
        "store_config": False,
        "inventory_management": False,
        "counted_items": False,
        "export_functionality": False,
        "inventory_closure": False
    }
    
    try:
        # Step 1: Test store configuration
        test_results["store_config"] = test_store_configuration()
        
        # Step 2: Test inventory management (create 2 inventories)
        inventory1_id, inventory2_id = test_inventory_management()
        if inventory1_id and inventory2_id:
            test_results["inventory_management"] = True
        
        # Step 3: Test counted items (add 3 items, edit 1, delete 1)
        if inventory1_id:
            item_ids = test_counted_items(inventory1_id)
            if item_ids:
                test_results["counted_items"] = True
        
        # Step 4: Test export functionality
        if inventory1_id:
            test_results["export_functionality"] = test_export_functionality(inventory1_id)
        
        # Step 5: Test inventory closure and validation
        if inventory1_id:
            test_results["inventory_closure"] = test_inventory_closure(inventory1_id)
        
        # Final verification: List all inventories and verify item counts
        print(f"\n{Colors.BOLD}=== Final Verification ==={Colors.ENDC}")
        print_info("Final inventory list with item counts:")
        inventories = make_request("GET", "/inventories")
        if inventories:
            for inv in inventories:
                status_emoji = "🔒" if inv.get("status") == "closed" else "📝"
                print_info(f"{status_emoji} {inv.get('description', 'N/A')} - Items: {inv.get('item_count', 0)} - Status: {inv.get('status', 'unknown')}")
        
    except Exception as e:
        print_error(f"Test execution failed with error: {str(e)}")
    
    # Print final summary
    print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.ENDC}")
    total_tests = len(test_results)
    passed_tests = sum(test_results.values())
    
    for test_name, passed in test_results.items():
        status_icon = "✅" if passed else "❌"
        print(f"{status_icon} {test_name.replace('_', ' ').title()}: {'PASSED' if passed else 'FAILED'}")
    
    print(f"\n{Colors.BOLD}Overall Result: {passed_tests}/{total_tests} tests passed{Colors.ENDC}")
    
    if passed_tests == total_tests:
        print_success("🎉 ALL TESTS PASSED! Backend API is working correctly.")
        return True
    else:
        print_error(f"❌ {total_tests - passed_tests} test(s) failed. Backend needs attention.")
        return False

if __name__ == "__main__":
    print(f"Testing Inventory Management API at: {BASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    success = test_comprehensive_scenario()
    sys.exit(0 if success else 1)