#!/bin/bash
# Security Test Suite for Wayfinder AI Backend
# Run this script to verify security measures are working

set -e

API_URL="${API_URL:-http://localhost:3001}"
FAILED=0
PASSED=0

echo "🔐 Wayfinder AI Security Test Suite"
echo "Testing API: $API_URL"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

function test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

function test_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Health Check
echo "Test 1: Health Check"
if curl -s "$API_URL/health" | grep -q "ok"; then
    test_pass "Health endpoint accessible"
else
    test_fail "Health endpoint not accessible"
fi
echo ""

# Test 2: Security Headers
echo "Test 2: Security Headers"
HEADERS=$(curl -sI "$API_URL/health")

if echo "$HEADERS" | grep -qi "X-Content-Type-Options: nosniff"; then
    test_pass "X-Content-Type-Options header present"
else
    test_fail "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
    test_pass "X-Frame-Options header present"
else
    test_fail "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
    test_pass "HSTS header present"
else
    test_warn "HSTS header missing (expected in HTTPS only)"
fi

if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
    test_pass "CSP header present"
else
    test_fail "CSP header missing"
fi
echo ""

# Test 3: CORS Protection
echo "Test 3: CORS Protection"
CORS_RESPONSE=$(curl -s -H "Origin: http://evil.com" -I "$API_URL/health" 2>&1 || true)
if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin: http://evil.com"; then
    test_fail "CORS allows unauthorized origin"
else
    test_pass "CORS blocks unauthorized origins"
fi
echo ""

# Test 4: Rate Limiting - Auth Endpoint
echo "Test 4: Rate Limiting on Auth Endpoints"
echo "Sending 6 rapid requests to signup endpoint..."
RATE_LIMITED=false
for i in {1..6}; do
    RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/auth/signup" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"Test1234"}' \
        -o /dev/null)
    
    if [ "$RESPONSE" = "429" ]; then
        RATE_LIMITED=true
        break
    fi
done

if [ "$RATE_LIMITED" = true ]; then
    test_pass "Rate limiting working on auth endpoint"
else
    test_warn "Rate limiting not triggered (may need more requests or check logs)"
fi
echo ""

# Test 5: Input Validation - Invalid URL
echo "Test 5: Input Validation"
RESPONSE=$(curl -s -X POST "$API_URL/api/agent/execute" \
    -H "Content-Type: application/json" \
    -d '{"taskDescription":"test","startUrl":"not-a-url"}')

if echo "$RESPONSE" | grep -qi "Invalid URL\|error"; then
    test_pass "Invalid URL format rejected"
else
    test_fail "Invalid URL format not rejected"
fi
echo ""

# Test 6: SSRF Protection - Internal URL
echo "Test 6: SSRF Protection"
RESPONSE=$(curl -s -X POST "$API_URL/api/agent/execute" \
    -H "Content-Type: application/json" \
    -d '{"taskDescription":"test","startUrl":"http://localhost:8080"}')

if echo "$RESPONSE" | grep -qi "internal\|not allowed\|error"; then
    test_pass "Internal URL blocked"
else
    test_fail "Internal URL not blocked - SSRF vulnerability!"
fi

RESPONSE=$(curl -s -X POST "$API_URL/api/agent/execute" \
    -H "Content-Type: application/json" \
    -d '{"taskDescription":"test","startUrl":"http://169.254.169.254/latest/meta-data/"}')

if echo "$RESPONSE" | grep -qi "internal\|not allowed\|private\|error"; then
    test_pass "Cloud metadata URL blocked"
else
    test_fail "Cloud metadata URL not blocked - SSRF vulnerability!"
fi

RESPONSE=$(curl -s -X POST "$API_URL/api/agent/execute" \
    -H "Content-Type: application/json" \
    -d '{"taskDescription":"test","startUrl":"http://192.168.1.1"}')

if echo "$RESPONSE" | grep -qi "private\|not allowed\|error"; then
    test_pass "Private IP range blocked"
else
    test_fail "Private IP not blocked - SSRF vulnerability!"
fi
echo ""

# Test 7: SQL Injection Attempt (should be sanitized)
echo "Test 7: Input Sanitization"
RESPONSE=$(curl -s -X POST "$API_URL/api/agent/execute" \
    -H "Content-Type: application/json" \
    -d "{\"taskDescription\":\"test'; DROP TABLE users;--\",\"startUrl\":\"https://example.com\"}")

if echo "$RESPONSE" | grep -qi "sessionId\|queued\|error"; then
    test_pass "SQL injection attempt sanitized or rejected"
else
    test_warn "Unexpected response to SQL injection attempt"
fi
echo ""

# Test 8: XSS Attempt
echo "Test 8: XSS Protection"
RESPONSE=$(curl -s -X POST "$API_URL/api/agent/execute" \
    -H "Content-Type: application/json" \
    -d "{\"taskDescription\":\"<script>alert('XSS')</script>\",\"startUrl\":\"https://example.com\"}")

if echo "$RESPONSE" | grep -qi "<script>"; then
    test_fail "XSS payload not sanitized - potential vulnerability!"
else
    test_pass "XSS payload sanitized"
fi
echo ""

# Test 9: Oversized Request
echo "Test 9: Request Size Limits"
LARGE_PAYLOAD=$(python3 -c "print('A' * (11 * 1024 * 1024))" 2>/dev/null || echo "")
if [ -n "$LARGE_PAYLOAD" ]; then
    RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/agent/execute" \
        -H "Content-Type: application/json" \
        -d "{\"taskDescription\":\"$LARGE_PAYLOAD\",\"startUrl\":\"https://example.com\"}" \
        -o /dev/null)
    
    if [ "$RESPONSE" = "413" ] || [ "$RESPONSE" = "400" ]; then
        test_pass "Oversized request rejected"
    else
        test_fail "Oversized request not rejected - potential DoS vulnerability!"
    fi
else
    test_warn "Could not generate large payload (need Python)"
fi
echo ""

# Test 10: Error Message Information Leakage
echo "Test 10: Error Information Leakage"
RESPONSE=$(curl -s "$API_URL/api/agent/status/nonexistent-session-id-12345")

if echo "$RESPONSE" | grep -qi "\/Users\|\/home\|C:\\\|stack trace"; then
    test_fail "Error messages expose file paths - information leakage!"
else
    test_pass "Error messages don't expose sensitive information"
fi
echo ""

# Test 11: Authentication Token Validation
echo "Test 11: Authentication Protection"
RESPONSE=$(curl -s -X GET "$API_URL/api/auth/profile")

if echo "$RESPONSE" | grep -qi "unauthorized\|not authenticated\|error"; then
    test_pass "Unauthenticated request to protected endpoint rejected"
else
    test_warn "Protected endpoint behavior unclear"
fi
echo ""

# Test 12: Password Strength Requirements
echo "Test 12: Password Strength Validation"
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"weak"}')

if echo "$RESPONSE" | grep -qi "password.*8\|too weak\|error"; then
    test_pass "Weak password rejected"
else
    test_warn "Weak password validation unclear"
fi
echo ""

# Summary
echo "================================"
echo "Security Test Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠️  SECURITY ISSUES DETECTED!${NC}"
    echo "Please review failed tests and fix vulnerabilities before deploying."
    exit 1
else
    echo -e "${GREEN}✅ All security tests passed!${NC}"
    echo "Application security measures are working as expected."
    exit 0
fi
